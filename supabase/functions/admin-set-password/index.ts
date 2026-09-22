// Supabase Edge Function: admin-set-password
//
// Lets an admin set a crew/office member's password directly, without
// sending a reset email. Runs with the secret key (server-side only) to
// call the Auth Admin API, which the browser can never do directly.
//
// Self-contained (no ../_shared imports) so it can be deployed on its own
// via the Supabase Dashboard's single-function editor, not just the CLI.
//
// Invoked from the client via
// supabase.functions.invoke('admin-set-password', { body: {...} })
// in src/lib/api.ts (see adminSetPassword).

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

interface SetPasswordPayload {
  userId: string;
  password: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization') ?? '';

  // Identify the caller using their own JWT (publishable key + their access token).
  const callerClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: 'Not authenticated.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

  const { data: callerProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single();

  if (profileError || !callerProfile || callerProfile.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Only admins can set a password directly.' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const payload: SetPasswordPayload = await req.json();

  if (!payload.userId?.trim()) {
    return new Response(JSON.stringify({ error: 'userId is required.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!payload.password || payload.password.length < 6) {
    return new Response(JSON.stringify({ error: 'Password must be at least 6 characters.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { error: updateError } = await adminClient.auth.admin.updateUserById(payload.userId, {
    password: payload.password,
  });

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
