import { supabase, ATTACHMENTS_BUCKET } from './supabase';
import {
  Attachment,
  AttachmentPhase,
  BillingType,
  CallPriority,
  CallStatus,
  Client,
  CommunicationMethod,
  CommunicationNote,
  CommunicationStatus,
  CustomerCommunication,
  Responsibility,
  ServiceCall,
  ServiceCallNote,
  UserProfile,
  UserRole,
} from '../types';

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour, per spec section 5.11

// ---------- Error translation ----------

// Maps raw Postgres constraint/column names (from schema.sql) to the
// human-readable message shown in the UI, so a user never sees
// `violates check constraint "install_before_report"` directly.
const CONSTRAINT_MESSAGES: Record<string, string> = {
  install_before_report: 'Install date cannot be before the reported date.',
  blocked_needs_reason: 'A reason is required when marking a call blocked.',
  completed_fields_present: 'A completed call must record who completed it and when.',
  service_calls_description_check: 'Issue description must be between 3 and 4000 characters.',
  service_calls_job_number_check: 'Job number must be between 1 and 30 characters.',
  clients_name_check: 'Client name must be at least 2 characters.',
  profiles_full_name_check: 'Full name must be between 2 and 120 characters.',
  service_call_notes_body_check: 'Note must be between 1 and 2000 characters.',
  attachments_size_bytes_check: 'File exceeds the 100 MB upload limit.',
  profiles_email_key: 'An account with this email address already exists.',
  clients_pkey: 'That client record no longer exists.',
  customer_communications_service_call_id_fkey: 'Please select a job for this communication.',
  customer_communications_summary_check: 'Summary must be between 3 and 1000 characters.',
  communication_notes_body_check: 'Note must be between 1 and 2000 characters.',
};

/**
 * Turns a raw Supabase/Postgres error into a message a non-technical user
 * can act on. Falls back to the original message if nothing matches, so we
 * never silently swallow an unexpected error.
 */
function friendlyDbError(message: string): string {
  const constraintMatch = message.match(/constraint "([^"]+)"/);
  if (constraintMatch && CONSTRAINT_MESSAGES[constraintMatch[1]]) {
    return CONSTRAINT_MESSAGES[constraintMatch[1]];
  }

  const columnMatch = message.match(/column "([^"]+)"/);
  if (columnMatch) {
    return `Please fill in the required field: ${columnMatch[1].replace(/_/g, ' ')}.`;
  }

  if (message.includes('duplicate key value')) {
    return 'A record with those details already exists.';
  }
  if (message.includes('permission denied') || message.includes('policy')) {
    return "You don't have permission to do that.";
  } 

  return message;
}

/**
 * Turns a Supabase Edge Function invocation error into a readable message.
 * `supabase.functions.invoke` hides the real error behind generic wrappers
 * (e.g. "Edge Function returned a non-2xx status code" or "Failed to send a
 * request to the Edge Function"), so we read the actual response body when
 * possible and give an actionable hint otherwise.
 */
async function describeFunctionError(error: any): Promise<string> {
  if (error?.context && typeof error.context.json === 'function') {
    try {
      const body = await error.context.json();
      if (body?.error) return body.error;
    } catch {
      // response wasn't JSON — fall through
    }
  }

  if (error?.name === 'FunctionsFetchError' || /failed to send a request/i.test(error?.message || '')) {
    return 'Could not reach the server. Check that the Edge Function is deployed and try again.';
  }

  return error?.message || 'The request could not be completed. Please try again.';
}

// ---------- Row -> App model mappers ----------

function mapProfile(row: any): UserProfile {
  return {
    id: row.id,
    fullName: row.full_name,
    role: row.role,
    email: row.email,
    phone: row.phone,
    isActive: row.is_active,
    notifyByEmail: row.notify_by_email,
    createdAt: row.created_at,
  };
}

function mapClient(row: any): Client {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    createdAt: row.created_at,
  };
}

async function mapAttachment(row: any): Promise<Attachment> {
  const url = await getSignedUrl(row.storage_path);
  return {
    id: row.id,
    serviceCallId: row.service_call_id,
    storagePath: row.storage_path,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    kind: row.kind,
    phase: row.phase,
    uploadedBy: row.uploaded_by,
    uploaderName: row.uploader?.full_name,
    createdAt: row.created_at,
    url,
  };
}

function mapNote(row: any): ServiceCallNote {
  return {
    id: row.id,
    serviceCallId: row.service_call_id,
    authorId: row.author_id,
    authorName: row.author?.full_name || 'Unknown',
    authorRole: row.author?.role || 'office',
    body: row.body,
    visibility: row.visibility,
    createdAt: row.created_at,
  };
}

async function mapServiceCall(row: any): Promise<ServiceCall> {
  const attachments = row.attachments
    ? await Promise.all(row.attachments.map(mapAttachment))
    : [];
  const notes = row.notes ? row.notes.map(mapNote) : [];

  return {
    id: row.id,
    jobNumber: row.job_number,
    clientId: row.client_id,
    client: row.client ? mapClient(row.client) : undefined,
    installerId: row.installer_id,
    installer: row.installer ? mapProfile(row.installer) : null,
    reportedDate: row.reported_date,
    installDate: row.install_date,
    priority: row.priority,
    description: row.description,
    responsibility: row.responsibility,
    billing: row.billing,
    status: row.status,
    completionNote: row.completion_note,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    completedByName: row.completed_by_profile?.full_name || null,
    nextFollowUpDate: row.next_follow_up_date,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    deletedByName: row.deleted_by_profile?.full_name || null,
    attachments,
    notes: notes.sort(
      (a: ServiceCallNote, b: ServiceCallNote) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    ),
  };
}

const SERVICE_CALL_SELECT = `
  *,
  client:clients(*),
  installer:profiles!service_calls_installer_id_fkey(*),
  completed_by_profile:profiles!service_calls_completed_by_fkey(full_name),
  deleted_by_profile:profiles!service_calls_deleted_by_fkey(full_name),
  attachments(*),
  notes:service_call_notes(*, author:profiles!service_call_notes_author_id_fkey(full_name, role))
`;

// ---------- Auth ----------

export async function signIn(email: string, password: string): Promise<UserProfile> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);

  const profile = await getCurrentProfile();
  if (!profile) throw new Error('No profile found for this account.');
  if (!profile.isActive) {
    await supabase.auth.signOut();
    throw new Error('This account has been deactivated. Contact the administrator.');
  }
  return profile;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Sends a password-reset email. The link redirects back to this app with
 * `type=recovery` in the URL, which App.tsx detects to show SetPasswordView
 * before letting the user into any portal screen.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: window.location.origin,
  });
  if (error) throw new Error(error.message);
}

/**
 * Loads a profile by auth user id. Prefer this inside `onAuthStateChange`
 * handlers — calling `getSession()` there deadlocks supabase-js (auth lock).
 */
export async function getProfileById(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error || !data) return null;
  return mapProfile(data);
}

export async function getCurrentProfile(): Promise<UserProfile | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return null;
  return getProfileById(userId);
}

// ---------- Installers / Team ----------

export async function getActiveInstallers(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'installer')
    .eq('is_active', true)
    .order('full_name', { ascending: true });

  if (error) throw new Error(friendlyDbError(error.message));
  return (data || []).map(mapProfile);
}

export async function getAllTeamMembers(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('role', { ascending: true })
    .order('full_name', { ascending: true });

  if (error) throw new Error(friendlyDbError(error.message));
  return (data || []).map(mapProfile);
}

export async function setTeamMemberActive(userId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('profiles').update({ is_active: isActive }).eq('id', userId);
  if (error) throw new Error(friendlyDbError(error.message));
}

/**
 * Updates a crew/office member's name, phone, and role. Covered by the
 * "admin office manage profiles" RLS policy on profiles (UPDATE), so this
 * is a direct client-side write rather than an Edge Function call.
 */
export async function updateTeamMember(
  userId: string,
  input: { fullName: string; phone?: string | null; role: UserRole }
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: input.fullName.trim(),
      phone: input.phone?.trim() || null,
      role: input.role,
    })
    .eq('id', userId);
  if (error) throw new Error(friendlyDbError(error.message));
}

/**
 * Sets a crew/office member's password directly via the `admin-set-password`
 * Supabase Edge Function (supabase/functions/admin-set-password), which
 * holds the service role key server-side and calls the Auth Admin API — the
 * browser can't do this directly. Admin-only; enforced both here and inside
 * the function. No email is sent; the new password takes effect immediately.
 */
export async function adminSetPassword(userId: string, password: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('admin-set-password', {
    body: { userId, password },
  });
  if (error) throw new Error(await describeFunctionError(error));
  if (data?.error) throw new Error(data.error);
}

/**
 * Team members who have never signed in (their auth account has no
 * last_sign_in_at yet — typically because an invite email never got
 * delivered or was never completed). Backed by the `admin-set-password`
 * Edge Function's `list_unactivated` action, since only the service role
 * can see auth.users state.
 */
export async function listUnactivatedTeamMembers(): Promise<
  { id: string; fullName: string; email: string; role: UserRole }[]
> {
  const { data, error } = await supabase.functions.invoke('admin-set-password', {
    body: { action: 'list_unactivated' },
  });
  if (error) throw new Error(await describeFunctionError(error));
  if (data?.error) throw new Error(data.error);
  return (data?.users || []).map((u: any) => ({
    id: u.id,
    fullName: u.full_name,
    email: u.email,
    role: u.role,
  }));
}

/**
 * Sets the same password for a batch of never-signed-in team members in one
 * call (the "activate everyone who hasn't set a password yet" flow). The
 * Edge Function recomputes who's still never-signed-in server-side, so this
 * can never overwrite a password for someone who's already active.
 */
export async function bulkActivateTeamMembers(userIds: string[], password: string): Promise<number> {
  const { data, error } = await supabase.functions.invoke('admin-set-password', {
    body: { action: 'bulk_set_password', userIds, password },
  });
  if (error) throw new Error(await describeFunctionError(error));
  if (data?.error) throw new Error(data.error);
  return data?.updatedCount || 0;
}

/**
 * Invites a new crew member via the `invite-crew` Supabase Edge Function
 * (supabase/functions/invite-crew), which holds the service role key
 * server-side and calls the Auth Admin API — the browser can't do this
 * directly. Admin-only; enforced both here and inside the function.
 */
export async function inviteCrewMember(input: {
  fullName: string;
  email: string;
  role: UserRole;
  phone?: string;
}): Promise<void> {
  const { data, error } = await supabase.functions.invoke('invite-crew', {
    body: {
      fullName: input.fullName.trim(),
      email: input.email.trim().toLowerCase(),
      role: input.role,
      phone: input.phone?.trim() || null,
    },
  });

  if (error) throw new Error(await describeFunctionError(error));
  if (data?.error) throw new Error(data.error);
}

// ---------- Clients ----------

export async function getClients(): Promise<Client[]> {
  const { data, error } = await supabase.from('clients').select('*').order('name', { ascending: true });
  if (error) throw new Error(friendlyDbError(error.message));
  return (data || []).map(mapClient);
}

export async function createClient(input: {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}): Promise<Client> {
  const profile = await getCurrentProfile();
  const { data, error } = await supabase
    .from('clients')
    .insert({
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      created_by: profile?.id || null,
    })
    .select('*')
    .single();

  if (error) throw new Error(friendlyDbError(error.message));
  return mapClient(data);
}

// ---------- Service Calls ----------

/**
 * RLS at the database level restricts this to the caller's own rows when they
 * are an installer (see supabase/schema.sql policy "installers read own calls").
 * No role filtering needs to happen client-side.
 */
export async function getServiceCalls(): Promise<ServiceCall[]> {
  const { data, error } = await supabase
    .from('service_calls')
    .select(SERVICE_CALL_SELECT)
    .is('deleted_at', null)
    .order('reported_date', { ascending: false });

  if (error) throw new Error(friendlyDbError(error.message));
  return Promise.all((data || []).map(mapServiceCall));
}

export async function getServiceCallById(callId: string): Promise<ServiceCall | null> {
  const { data, error } = await supabase
    .from('service_calls')
    .select(SERVICE_CALL_SELECT)
    .eq('id', callId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new Error(friendlyDbError(error.message));
  if (!data) return null;
  return mapServiceCall(data);
}

/**
 * Soft-deleted service calls, newest-deleted first — backs the admin-only
 * Trash view. Only admins can see a soft-deleted row at all (see
 * "installers read own calls" in supabase/schema.sql); this returns an
 * empty list for anyone else.
 */
export async function getDeletedServiceCalls(): Promise<ServiceCall[]> {
  const { data, error } = await supabase
    .from('service_calls')
    .select(SERVICE_CALL_SELECT)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });

  if (error) throw new Error(friendlyDbError(error.message));
  return Promise.all((data || []).map(mapServiceCall));
}

export async function createServiceCall(input: {
  jobNumber: string;
  clientId: string;
  installerId: string | null;
  reportedDate: string;
  installDate?: string | null;
  priority: CallPriority;
  description: string;
  responsibility: Responsibility;
  billing: BillingType;
}): Promise<ServiceCall> {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error('Not authenticated.');

  const { data, error } = await supabase
    .from('service_calls')
    .insert({
      job_number: input.jobNumber.trim(),
      client_id: input.clientId,
      installer_id: input.installerId || null,
      reported_date: input.reportedDate,
      install_date: input.installDate || null,
      priority: input.priority,
      description: input.description.trim(),
      responsibility: input.responsibility,
      billing: input.billing,
      status: 'open',
      created_by: profile.id,
    })
    .select(SERVICE_CALL_SELECT)
    .single();

  if (error) throw new Error(friendlyDbError(error.message));
  const call = await mapServiceCall(data);

  if (call.installerId && call.installer) {
    await dispatchNotification({ call, installer: call.installer, eventType: 'new_call' });
  }

  return call;
}

export async function updateServiceCall(
  callId: string,
  updates: {
    installerId?: string | null;
    priority?: CallPriority;
    responsibility?: Responsibility;
    billing?: BillingType;
    status?: CallStatus;
    nextFollowUpDate?: string | null;
  }
): Promise<ServiceCall> {
  const previous = await getServiceCallById(callId);
  if (!previous) throw new Error('Service call not found.');

  const isReassigned =
    updates.installerId !== undefined && updates.installerId !== previous.installerId;

  // The DB requires completed_at/completed_by whenever status = 'completed'
  // (see the completed_fields_present constraint in schema.sql). The
  // installer's phone-complete RPC stamps these automatically, but this
  // office-side path needs to stamp them itself when office marks a call
  // completed directly.
  let completedStamp: { completed_at: string; completed_by: string } | undefined;
  if (updates.status === 'completed' && previous.status !== 'completed') {
    const officeUser = await getCurrentProfile();
    if (!officeUser) throw new Error('Not authenticated.');
    completedStamp = { completed_at: new Date().toISOString(), completed_by: officeUser.id };
  }

  const { data, error } = await supabase
    .from('service_calls')
    .update({
      installer_id: updates.installerId,
      priority: updates.priority,
      responsibility: updates.responsibility,
      billing: updates.billing,
      status: updates.status,
      next_follow_up_date: updates.nextFollowUpDate,
      updated_at: new Date().toISOString(),
      ...completedStamp,
    })
    .eq('id', callId)
    .select(SERVICE_CALL_SELECT)
    .single();

  if (error) throw new Error(friendlyDbError(error.message));
  const call = await mapServiceCall(data);

  if (isReassigned && call.installerId && call.installer) {
    await dispatchNotification({ call, installer: call.installer, eventType: 'reassigned' });
  }

  return call;
}

/**
 * Soft-deletes a service call via the soft_delete_service_call RPC
 * (supabase/schema.sql), which stamps deleted_at/deleted_by from the
 * server side and checks auth_role() = 'admin' itself — restricted to
 * admins at the database level, not just by hiding the button in the UI.
 */
export async function deleteServiceCall(callId: string): Promise<void> {
  const { error } = await supabase.rpc('soft_delete_service_call', { p_call_id: callId });
  if (error) throw new Error(friendlyDbError(error.message));
}

/**
 * Undoes a soft delete via the restore_service_call RPC, putting the call
 * back in every normal view. Admin-only, enforced the same way as delete.
 */
export async function restoreServiceCall(callId: string): Promise<void> {
  const { error } = await supabase.rpc('restore_service_call', { p_call_id: callId });
  if (error) throw new Error(friendlyDbError(error.message));
}

/**
 * Permanently deletes a service call (and, via ON DELETE CASCADE, its
 * attachments and notes) — irreversible. Restricted to admins by the
 * "admin delete calls" RLS policy in supabase/schema.sql. Only reachable
 * from the Trash view's "Delete Forever" action.
 */
export async function permanentlyDeleteServiceCall(callId: string): Promise<void> {
  const { error } = await supabase.from('service_calls').delete().eq('id', callId);
  if (error) throw new Error(friendlyDbError(error.message));
}

/**
 * Calls the installer_complete_call RPC (supabase/schema.sql, Section 10),
 * which is the only write path installers are permitted to take on a
 * service_calls row: status in ('completed','blocked','in_progress') and,
 * for 'blocked', a non-empty reason note.
 */
export async function installerCompleteCall(input: {
  callId: string;
  status: 'completed' | 'blocked' | 'in_progress';
  note?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('installer_complete_call', {
    p_call_id: input.callId,
    p_status: input.status,
    p_note: input.note || null,
  });

  if (error) throw new Error(friendlyDbError(error.message));

  if (input.note && input.note.trim()) {
    await addNote(input.callId, input.note.trim(), 'shared');
  }

  if (input.status === 'completed' || input.status === 'blocked') {
    const call = await getServiceCallById(input.callId);
    if (call) {
      await dispatchOfficeNotification({ call, eventType: input.status, note: input.note });
    }
  }
}

// ---------- Notes ----------

export async function addNote(
  callId: string,
  body: string,
  visibility: 'shared' | 'internal' = 'shared'
): Promise<ServiceCallNote> {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error('Not authenticated.');

  const { data, error } = await supabase
    .from('service_call_notes')
    .insert({
      service_call_id: callId,
      author_id: profile.id,
      body: body.trim(),
      visibility,
    })
    .select('*, author:profiles!service_call_notes_author_id_fkey(full_name, role)')
    .single();

  if (error) throw new Error(friendlyDbError(error.message));
  return mapNote(data);
}

// ---------- Attachments ----------

export async function getSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (error || !data) return '';
  return data.signedUrl;
}

export async function uploadAttachment(input: {
  callId: string;
  file: File;
  phase: AttachmentPhase;
}): Promise<Attachment> {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error('Not authenticated.');

  const isVideo = input.file.type.startsWith('video/');
  const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${input.callId}/${input.phase}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(storagePath, input.file, {
      contentType: input.file.type,
      cacheControl: '3600',
    });

  if (uploadError) throw new Error(friendlyDbError(uploadError.message));

  const { data, error } = await supabase
    .from('attachments')
    .insert({
      service_call_id: input.callId,
      storage_path: storagePath,
      file_name: input.file.name,
      mime_type: input.file.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
      size_bytes: input.file.size,
      kind: isVideo ? 'video' : 'image',
      phase: input.phase,
      uploaded_by: profile.id,
    })
    .select('*')
    .single();

  if (error) throw new Error(friendlyDbError(error.message));
  return mapAttachment({ ...data, uploader: { full_name: profile.fullName } });
}

// ---------- Notifications ----------

/**
 * Dispatches the "new call assigned" / "reassigned" email via the
 * `send-notification` Supabase Edge Function (supabase/functions/send-notification),
 * which holds the Resend API key server-side and writes to notification_log.
 * Failures are logged but never block the calling UI action.
 */
async function dispatchNotification(input: {
  call: ServiceCall;
  installer: UserProfile;
  eventType: 'new_call' | 'reassigned';
}): Promise<void> {
  if (!input.installer.notifyByEmail) return;

  try {
    const { error } = await supabase.functions.invoke('send-notification', {
      body: {
        serviceCallId: input.call.id,
        eventType: input.eventType,
        recipientEmail: input.installer.email,
        recipientName: input.installer.fullName,
        jobNumber: input.call.jobNumber,
        clientName: input.call.client?.name || 'Customer',
        clientPhone: input.call.client?.phone || null,
        clientAddress: input.call.client?.address || null,
        priority: input.call.priority,
        description: input.call.description,
        reportedDate: input.call.reportedDate,
        responsibility: input.call.responsibility,
        billing: input.call.billing,
      },
    });
    if (error) console.error('Notification dispatch failed:', await describeFunctionError(error));
  } catch (err) {
    console.error('Notification dispatch failed:', err);
  }
}

const OFFICE_NOTIFICATION_EMAIL = 'office@everlastbathrooms.com';

/**
 * Dispatches the "call completed" / "call blocked" email to the office
 * inbox via the same `send-notification` Edge Function. Always sent
 * regardless of any individual user's notify_by_email preference, since
 * this goes to a shared office address rather than a specific person.
 */
async function dispatchOfficeNotification(input: {
  call: ServiceCall;
  eventType: 'completed' | 'blocked';
  note?: string;
}): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('send-notification', {
      body: {
        serviceCallId: input.call.id,
        eventType: input.eventType,
        recipientEmail: OFFICE_NOTIFICATION_EMAIL,
        recipientName: 'Office',
        jobNumber: input.call.jobNumber,
        clientName: input.call.client?.name || 'Customer',
        clientPhone: input.call.client?.phone || null,
        clientAddress: input.call.client?.address || null,
        priority: input.call.priority,
        description: input.call.description,
        reportedDate: input.call.reportedDate,
        responsibility: input.call.responsibility,
        billing: input.call.billing,
        completionNote: input.note || input.call.completionNote || null,
      },
    });
    if (error) console.error('Office notification dispatch failed:', await describeFunctionError(error));
  } catch (err) {
    console.error('Office notification dispatch failed:', err);
  }
}

// ---------- Customer Service Log (office/admin only, always tied to a job) ----------
//
// Per client: "Always related to a job, and its just internal so we can
// keep track of every request." Every entry links to a service_calls row —
// the client's name comes from that job's linked client, not duplicated
// here. No client accounts, no client-facing communication, no email.
//
// RLS on customer_communications / communication_notes (supabase/schema.sql
// and supabase/migrations/20260922000000_customer_communications_log.sql)
// grants access only to 'admin' and 'office' roles — there is no installer
// policy at all, so this is enforced at the database regardless of what the
// UI shows.

function mapCommunicationNote(row: any): CommunicationNote {
  return {
    id: row.id,
    communicationId: row.communication_id,
    authorId: row.author_id,
    authorName: row.author?.full_name || 'Unknown',
    body: row.body,
    createdAt: row.created_at,
  };
}

function mapCommunication(row: any): CustomerCommunication {
  const notes = row.notes ? row.notes.map(mapCommunicationNote) : [];
  return {
    id: row.id,
    clientId: row.client_id,
    serviceCallId: row.service_call_id,
    // Prefer the live job/client (job number can change, a new handler can
    // pick up the client) but fall back to the direct client link, then the
    // snapshot taken at creation time once both have been deleted.
    jobNumber: row.service_call?.job_number ?? row.job_number_snapshot,
    clientName: row.service_call?.client?.name ?? row.client?.name ?? row.client_name_snapshot,
    clientPhone: row.service_call?.client?.phone ?? row.client?.phone ?? row.client_phone_snapshot,
    dateReceived: row.date_received,
    method: row.method,
    status: row.status,
    handledBy: row.handled_by,
    handledByName: row.handled_by_profile?.full_name,
    summary: row.summary,
    nextFollowUpDate: row.next_follow_up_date,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    deletedByName: row.deleted_by_profile?.full_name || null,
    notes: notes.sort(
      (a: CommunicationNote, b: CommunicationNote) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    ),
  };
}

const COMMUNICATION_SELECT = `
  *,
  client:clients(name, phone),
  service_call:service_calls(job_number, client:clients(name, phone)),
  handled_by_profile:profiles!customer_communications_handled_by_fkey(full_name),
  deleted_by_profile:profiles!customer_communications_deleted_by_fkey(full_name),
  notes:communication_notes(*, author:profiles!communication_notes_author_id_fkey(full_name))
`;

export async function getCommunications(): Promise<CustomerCommunication[]> {
  const { data, error } = await supabase
    .from('customer_communications')
    .select(COMMUNICATION_SELECT)
    .is('deleted_at', null)
    .order('date_received', { ascending: false });

  if (error) throw new Error(friendlyDbError(error.message));
  return (data || []).map(mapCommunication);
}

export async function getCommunicationsForServiceCall(serviceCallId: string): Promise<CustomerCommunication[]> {
  const { data, error } = await supabase
    .from('customer_communications')
    .select(COMMUNICATION_SELECT)
    .eq('service_call_id', serviceCallId)
    .is('deleted_at', null)
    .order('date_received', { ascending: false });

  if (error) throw new Error(friendlyDbError(error.message));
  return (data || []).map(mapCommunication);
}

export async function getCommunicationById(id: string): Promise<CustomerCommunication | null> {
  const { data, error } = await supabase
    .from('customer_communications')
    .select(COMMUNICATION_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new Error(friendlyDbError(error.message));
  if (!data) return null;
  return mapCommunication(data);
}

/**
 * Soft-deleted communication tickets, newest-deleted first — backs the
 * admin-only Trash view.
 */
export async function getDeletedCommunications(): Promise<CustomerCommunication[]> {
  const { data, error } = await supabase
    .from('customer_communications')
    .select(COMMUNICATION_SELECT)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });

  if (error) throw new Error(friendlyDbError(error.message));
  return (data || []).map(mapCommunication);
}

export async function createCommunication(input: {
  clientId: string;
  serviceCallId?: string | null;
  dateReceived: string;
  method: CommunicationMethod;
  handledBy: string;
  summary: string;
}): Promise<CustomerCommunication> {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error('Not authenticated.');

  const { data, error } = await supabase
    .from('customer_communications')
    .insert({
      client_id: input.clientId,
      service_call_id: input.serviceCallId || null,
      date_received: input.dateReceived,
      method: input.method,
      status: 'open',
      handled_by: input.handledBy,
      summary: input.summary.trim(),
      created_by: profile.id,
    })
    .select(COMMUNICATION_SELECT)
    .single();

  if (error) throw new Error(friendlyDbError(error.message));
  return mapCommunication(data);
}

export async function updateCommunication(
  id: string,
  updates: {
    status?: CommunicationStatus;
    handledBy?: string;
    method?: CommunicationMethod;
    summary?: string;
    nextFollowUpDate?: string | null;
  }
): Promise<CustomerCommunication> {
  const { data, error } = await supabase
    .from('customer_communications')
    .update({
      status: updates.status,
      handled_by: updates.handledBy,
      method: updates.method,
      summary: updates.summary?.trim(),
      next_follow_up_date: updates.nextFollowUpDate,
    })
    .eq('id', id)
    .select(COMMUNICATION_SELECT)
    .single();

  if (error) throw new Error(friendlyDbError(error.message));
  return mapCommunication(data);
}

/**
 * Soft-deletes a communication ticket via the soft_delete_communication RPC
 * (supabase/schema.sql), which stamps deleted_at/deleted_by from the
 * server side and checks auth_role() = 'admin' itself — restricted to
 * admins at the database level, not just by hiding the button in the UI.
 */
export async function deleteCommunication(id: string): Promise<void> {
  const { error } = await supabase.rpc('soft_delete_communication', { p_id: id });
  if (error) throw new Error(friendlyDbError(error.message));
}

/**
 * Undoes a soft delete via the restore_communication RPC, putting the
 * ticket back in every normal view. Admin-only, enforced the same way as
 * delete.
 */
export async function restoreCommunication(id: string): Promise<void> {
  const { error } = await supabase.rpc('restore_communication', { p_id: id });
  if (error) throw new Error(friendlyDbError(error.message));
}

/**
 * Permanently deletes a logged customer service ticket (and, via ON DELETE
 * CASCADE, its update notes) — irreversible. Restricted to admins by the
 * "admin delete communications" RLS policy. Only reachable from the Trash
 * view's "Delete Forever" action.
 */
export async function permanentlyDeleteCommunication(id: string): Promise<void> {
  const { error } = await supabase.from('customer_communications').delete().eq('id', id);
  if (error) throw new Error(friendlyDbError(error.message));
}

export async function addCommunicationNote(communicationId: string, body: string): Promise<CommunicationNote> {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error('Not authenticated.');

  const { data, error } = await supabase
    .from('communication_notes')
    .insert({
      communication_id: communicationId,
      author_id: profile.id,
      body: body.trim(),
    })
    .select('*, author:profiles!communication_notes_author_id_fkey(full_name)')
    .single();

  if (error) throw new Error(friendlyDbError(error.message));
  return mapCommunicationNote(data);
}
