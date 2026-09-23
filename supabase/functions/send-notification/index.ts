// Supabase Edge Function: send-notification
//
// Sends transactional emails via Resend for: new_call / reassigned (to the
// assigned crew member) and completed / blocked (to the office inbox), and
// logs the outcome to notification_log. The Resend API key stays
// server-side here — it must never be shipped to the browser bundle.
//
// Deploy with: supabase functions deploy send-notification
// Configure secret with: supabase secrets set RESEND_API_KEY=...
// (SUPABASE_URL / SUPABASE_PUBLISHABLE_KEYS / SUPABASE_SECRET_KEYS are
// injected automatically — no need to set those yourself.)
//
// This function is invoked from the client via
// supabase.functions.invoke('send-notification', { body: {...} })
// in src/lib/api.ts (see dispatchNotification). It is not exercised by
// this build session — wire up RESEND_API_KEY and a verified sending
// domain in Resend, then test end to end.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';
import { getSecretKey } from '../_shared/keys.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const RESEND_FROM = Deno.env.get('RESEND_FROM_EMAIL') ?? 'dispatch@everlastbathrooms.com';
const PORTAL_URL = Deno.env.get('PORTAL_URL') ?? 'https://servicecalls.vercel.app';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SECRET_KEY = getSecretKey();

type EventType = 'new_call' | 'reassigned' | 'updated' | 'overdue' | 'completed' | 'blocked';

interface NotificationPayload {
  serviceCallId: string;
  eventType: EventType;
  recipientEmail: string;
  recipientName: string;
  jobNumber: string;
  clientName: string;
  clientPhone?: string | null;
  clientAddress?: string | null;
  priority: 'low' | 'mid' | 'high';
  description: string;
  reportedDate: string;
  responsibility: string;
  billing: string;
  completionNote?: string | null;
}

const SUBJECT_BY_EVENT: Record<EventType, (p: NotificationPayload) => string> = {
  new_call: (p) => `[Everlast Bathrooms] New Service Call Assigned: Job #${p.jobNumber} - ${p.clientName}`,
  reassigned: (p) => `[Everlast Bathrooms] Call Reassigned: Job #${p.jobNumber} - ${p.clientName}`,
  updated: (p) => `[Everlast Bathrooms] Call Updated: Job #${p.jobNumber} - ${p.clientName}`,
  overdue: (p) => `[Everlast Bathrooms] Overdue: Job #${p.jobNumber} - ${p.clientName}`,
  completed: (p) => `[Everlast Bathrooms] Call Completed: Job #${p.jobNumber} - ${p.clientName}`,
  blocked: (p) => `[Everlast Bathrooms] Call Blocked: Job #${p.jobNumber} - ${p.clientName}`,
};

const INTRO_BY_EVENT: Record<EventType, (p: NotificationPayload) => string> = {
  new_call: () => 'A new service call has been assigned to you. Review the details below before heading to the site.',
  reassigned: (p) => `Service call Job #${p.jobNumber} has been reassigned to you.`,
  updated: (p) => `Service call Job #${p.jobNumber} has been updated.`,
  overdue: (p) => `Service call Job #${p.jobNumber} has been open past the overdue threshold.`,
  completed: (p) => `${p.recipientName === 'Office' ? 'The crew' : p.recipientName} marked Job #${p.jobNumber} as <strong>completed</strong>.`,
  blocked: (p) => `${p.recipientName === 'Office' ? 'The crew' : p.recipientName} marked Job #${p.jobNumber} as <strong>blocked</strong> and cannot proceed.`,
};

function buildEmail(payload: NotificationPayload) {
  const subject = SUBJECT_BY_EVENT[payload.eventType](payload);
  const intro = INTRO_BY_EVENT[payload.eventType](payload);

  const priorityColor =
    payload.priority === 'high' ? '#C4342B' : payload.priority === 'mid' ? '#C97A16' : '#6B7A88';

  const html = `
    <div style="font-family: Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background:#FBFBF9; border:1px solid #DFE2DE; border-radius:8px; overflow:hidden;">
      <div style="background:#12161A; padding:20px 24px; color:#fff;">
        <h1 style="margin:0; font-size:20px;">EVERLAST BATHROOMS</h1>
        <p style="margin:4px 0 0; font-size:13px; color:#9CA3AF;">Service Call Work Order Dispatch</p>
      </div>
      <div style="padding:24px;">
        <div style="display:inline-block; padding:4px 10px; font-size:12px; font-weight:700; text-transform:uppercase; color:#fff; background:${priorityColor}; border-radius:4px; margin-bottom:16px;">
          ${payload.priority} PRIORITY
        </div>
        <h2 style="margin:0 0 8px; font-size:18px; color:#12161A;">Hello ${payload.recipientName},</h2>
        <p style="margin:0 0 20px; font-size:15px; color:#3A424B;">${intro}</p>
        <table style="width:100%; border-collapse:collapse; font-size:14px; background:#fff; border:1px solid #DFE2DE; border-radius:6px; padding:12px;">
          <tr><td style="padding:6px 0; color:#6B7A88; width:130px;">Job Number:</td><td style="padding:6px 0; font-weight:700;">#${payload.jobNumber}</td></tr>
          <tr><td style="padding:6px 0; color:#6B7A88;">Client:</td><td style="padding:6px 0; font-weight:600;">${payload.clientName}</td></tr>
          ${payload.clientPhone ? `<tr><td style="padding:6px 0; color:#6B7A88;">Phone:</td><td style="padding:6px 0;">${payload.clientPhone}</td></tr>` : ''}
          ${payload.clientAddress ? `<tr><td style="padding:6px 0; color:#6B7A88;">Address:</td><td style="padding:6px 0;">${payload.clientAddress}</td></tr>` : ''}
          <tr><td style="padding:6px 0; color:#6B7A88;">Reported:</td><td style="padding:6px 0;">${payload.reportedDate}</td></tr>
          <tr><td style="padding:6px 0; color:#6B7A88;">Responsibility:</td><td style="padding:6px 0; text-transform:capitalize;">${payload.responsibility}</td></tr>
          <tr><td style="padding:6px 0; color:#6B7A88;">Billing:</td><td style="padding:6px 0; text-transform:capitalize;">${payload.billing}</td></tr>
        </table>
        <div style="margin-top:14px; padding-top:14px; border-top:1px solid #DFE2DE;">
          <div style="font-size:13px; font-weight:600; color:#6B7A88; margin-bottom:6px;">ISSUE DESCRIPTION:</div>
          <div style="font-size:15px; color:#12161A; background:#FBFBF9; padding:12px; border-radius:4px; border-left:3px solid #0F5CC4;">
            ${payload.description}
          </div>
        </div>
        ${payload.completionNote ? `
        <div style="margin-top:14px; padding-top:14px; border-top:1px solid #DFE2DE;">
          <div style="font-size:13px; font-weight:600; color:#6B7A88; margin-bottom:6px;">
            ${payload.eventType === 'blocked' ? 'REASON GIVEN BY CREW:' : 'COMPLETION NOTE:'}
          </div>
          <div style="font-size:15px; color:#12161A; background:#FBFBF9; padding:12px; border-radius:4px; border-left:3px solid ${payload.eventType === 'blocked' ? '#C97A16' : '#0F5CC4'};">
            ${payload.completionNote}
          </div>
        </div>` : ''}
        <div style="margin-top:24px; text-align:center;">
          <a href="${PORTAL_URL}" style="display:inline-block; padding:12px 28px; background:#0F5CC4; color:#fff; font-size:14px; font-weight:700; text-decoration:none; border-radius:6px;">
            Open Portal
          </a>
          <p style="margin:10px 0 0; font-size:12px; color:#6B7A88;">
            View full details and photos in the Everlast Bathrooms portal.
          </p>
        </div>
      </div>
    </div>
  `;

  return { subject, html };
}

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const payload: NotificationPayload = await req.json();
  const { subject, html } = buildEmail(payload);

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

  let status: 'sent' | 'failed' = 'sent';
  let errorMessage: string | null = null;
  let providerId: string | null = null;

  try {
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [payload.recipientEmail],
        subject,
        html,
      }),
    });

    if (!resendResponse.ok) {
      status = 'failed';
      errorMessage = await resendResponse.text();
    } else {
      const result = await resendResponse.json();
      providerId = result.id ?? null;
    }
  } catch (err) {
    status = 'failed';
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  await supabaseAdmin.from('notification_log').insert({
    service_call_id: payload.serviceCallId,
    recipient_email: payload.recipientEmail,
    event_type: payload.eventType,
    provider_id: providerId,
    status,
    error: errorMessage,
    sent_at: status === 'sent' ? new Date().toISOString() : null,
  });

  return new Response(JSON.stringify({ status, error: errorMessage }), {
    status: status === 'sent' ? 200 : 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
