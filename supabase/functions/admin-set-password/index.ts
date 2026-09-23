// Supabase Edge Function: admin-set-password
//
// Lets an admin set a crew/office member's password directly, without
// sending a reset email. Runs with the secret key (server-side only) to
// call the Auth Admin API, which the browser can never do directly.
//
// Three request shapes, dispatched by an `action` field (default 'set_one'
// for backward compatibility with the original single-user caller):
//   - { userId, password }                          -> set one user's password
//   - { action: 'list_unactivated' }                 -> list team members who
//     have never signed in (auth.users.last_sign_in_at IS NULL), so the UI
//     can show who still needs to be activated
//   - { action: 'bulk_set_password', userIds, password } -> set the same
//     password for a batch of users, but ONLY those still never-signed-in
//     (recomputed server-side, ignoring any already-active ids the caller
//     might have sent) — this is what backs the "N team members haven't set
//     up their account yet, activate with everlast123" bulk-activation flow
//
// Self-contained (no ../_shared imports) so it can be deployed on its own
// via the Supabase Dashboard's single-function editor, not just the CLI.
//
// Invoked from the client via
// supabase.functions.invoke('admin-set-password', { body: {...} })
// in src/lib/api.ts (see adminSetPassword, listUnactivatedTeamMembers,
// bulkActivateTeamMembers).

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function firstValue(jsonDict: string): string {
  try {
    const parsed = JSON.parse(jsonDict);
    const values = Object.values(parsed);
    return typeof values[0] === 'string' ? (values[0] as string) : '';
  } catch {
    return '';
  }
}

function getPublishableKey(): string {
  const dict = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');
  if (dict) return firstValue(dict);
  return Deno.env.get('SUPABASE_ANON_KEY') ?? '';
}

function getSecretKey(): string {
  const dict = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (dict) return firstValue(dict);
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_PUBLISHABLE_KEY = getPublishableKey();
const SUPABASE_SECRET_KEY = getSecretKey();

interface RequestPayload {
  action?: 'list_unactivated' | 'bulk_set_password';
  userId?: string;
  userIds?: string[];
  password?: string;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Never-signed-in users among a page of auth users, keyed by id, limited to
// ids present in our profiles table (so we never touch a stray auth user
// that isn't one of our team members).
async function getNeverSignedInProfileIds(
  adminClient: ReturnType<typeof createClient>,
  profileIds: Set<string>
): Promise<Set<string>> {
  const neverSignedIn = new Set<string>();
  let page = 1;
  // 18 team members today; 1000/page comfortably covers this for a long time.
  const perPage = 1000;
  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    for (const u of data.users) {
      if (profileIds.has(u.id) && !u.last_sign_in_at) {
        neverSignedIn.add(u.id);
      }
    }
    if (data.users.length < perPage) break;
    page += 1;
  }
  return neverSignedIn;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization') ?? '';

  // Identify the caller using their own JWT (publishable key + their access token).
  const callerClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData?.user) {
    return jsonResponse({ error: 'Not authenticated.' }, 401);
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

  const { data: callerProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single();

  if (profileError || !callerProfile || callerProfile.role !== 'admin') {
    return jsonResponse({ error: 'Only admins can manage passwords directly.' }, 403);
  }

  const payload: RequestPayload = await req.json();

  if (payload.action === 'list_unactivated') {
    const { data: profiles, error: profilesError } = await adminClient
      .from('profiles')
      .select('id, full_name, email, role');
    if (profilesError) {
      return jsonResponse({ error: profilesError.message }, 400);
    }

    const profileIds = new Set((profiles || []).map((p) => p.id));
    let neverSignedIn: Set<string>;
    try {
      neverSignedIn = await getNeverSignedInProfileIds(adminClient, profileIds);
    } catch (e: any) {
      return jsonResponse({ error: e.message || 'Failed to list auth users.' }, 400);
    }

    const unactivated = (profiles || []).filter((p) => neverSignedIn.has(p.id));
    return jsonResponse({ users: unactivated });
  }

  if (payload.action === 'bulk_set_password') {
    if (!Array.isArray(payload.userIds) || payload.userIds.length === 0) {
      return jsonResponse({ error: 'userIds is required.' }, 400);
    }
    if (!payload.password || payload.password.length < 6) {
      return jsonResponse({ error: 'Password must be at least 6 characters.' }, 400);
    }

    const { data: profiles, error: profilesError } = await adminClient
      .from('profiles')
      .select('id');
    if (profilesError) {
      return jsonResponse({ error: profilesError.message }, 400);
    }
    const profileIds = new Set((profiles || []).map((p) => p.id));

    let neverSignedIn: Set<string>;
    try {
      neverSignedIn = await getNeverSignedInProfileIds(adminClient, profileIds);
    } catch (e: any) {
      return jsonResponse({ error: e.message || 'Failed to list auth users.' }, 400);
    }

    // Only ever touch ids that are (a) requested and (b) still never signed
    // in as of right now — never silently reset an active user's password.
    const targetIds = payload.userIds.filter((id) => neverSignedIn.has(id));

    const results = await Promise.all(
      targetIds.map(async (id) => {
        const { error } = await adminClient.auth.admin.updateUserById(id, { password: payload.password });
        return { id, ok: !error, error: error?.message };
      })
    );

    const updated = results.filter((r) => r.ok).map((r) => r.id);
    const failed = results.filter((r) => !r.ok);

    return jsonResponse({ success: true, updatedCount: updated.length, updated, failed });
  }

  // Default / backward-compatible: set a single user's password.
  if (!payload.userId?.trim()) {
    return jsonResponse({ error: 'userId is required.' }, 400);
  }

  if (!payload.password || payload.password.length < 6) {
    return jsonResponse({ error: 'Password must be at least 6 characters.' }, 400);
  }

  const { error: updateError } = await adminClient.auth.admin.updateUserById(payload.userId, {
    password: payload.password,
  });

  if (updateError) {
    return jsonResponse({ error: updateError.message }, 400);
  }

  return jsonResponse({ success: true });
});
