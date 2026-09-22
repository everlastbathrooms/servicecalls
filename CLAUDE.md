# Everlast Bathrooms — Service Call Portal

**Read this file before touching any code in this repo.** It's the source of truth for what this app is, why it's built the way it is, and what rules any future change (human or AI) must keep following.

If something here conflicts with what you see in the code, the code is stale — update this file when you change behavior, don't silently drift from it.

---

## 1. What this app is

A dispatch/field-crew portal for a bathroom remodeling company. Office staff log service calls (customer complaints/issues), assign them to a crew member, and the crew sees only their own calls on their phone, marks them complete or blocked, and uploads photos.

This is currently **Milestone 1 only** — a deliberately reduced scope. See §7 before adding anything that sounds like it belongs in a "full" version of this product.

**Stack:** Vite + React 19 + TypeScript, Tailwind CSS v4, Supabase (Postgres + Auth + Storage + Edge Functions), Resend (email). No server of its own — the browser talks to Supabase directly, and Supabase Edge Functions handle the few things that need a secret key.

---

## 2. Roles and what each one can do

Three roles, stored in `profiles.role`: `admin`, `office`, `installer`.

| Capability | admin | office | installer |
|---|---|---|---|
| Log in | ✅ | ✅ | ✅ |
| See own assigned calls | ✅ | ✅ | ✅ (only their own) |
| See **all** service calls | ✅ | ✅ | ❌ — blocked at the database level (RLS), not just hidden in the UI |
| Create / reassign / edit a call | ✅ | ✅ | ❌ |
| Mark a call complete / blocked | ✅ (as if office) | ✅ | ✅ (only calls assigned to them) |
| Upload office-side ("reported") photos | ✅ | ✅ | ❌ |
| Upload resolution ("after") photos | — | — | ✅ (only on their own calls) |
| Add notes | ✅ | ✅ (shared or internal-only) | ✅ (shared only) |
| Invite new crew/office accounts | ✅ **only** | ❌ | ❌ |
| Deactivate/reactivate accounts | ✅ **only** | ❌ | ❌ |
| Log / view / update customer service tickets (always tied to a job) | ✅ | ✅ | ❌ — **no policy grants installers any access at all**, RLS defaults to deny (see §3a) |

**Enforcement lives in the database, not the UI.** `supabase/schema.sql` has Row-Level Security (RLS) policies on every table — an installer's Supabase query for `service_calls` is *rewritten by Postgres* to only return rows where `installer_id = auth.uid()`. Never rely on hiding a button in React as the actual security boundary. If you add a new table or a new query path, it needs an RLS policy before it needs a UI.

The one write path installers get on `service_calls` is the `installer_complete_call` RPC (a Postgres function), which only accepts `status IN ('completed','blocked','in_progress')` and requires a non-empty reason when blocking. This is intentional — don't give installers a general `UPDATE` policy on `service_calls`.

---

## 3. Data model (see `supabase/schema.sql` for the actual DDL)

- **`profiles`** — extends `auth.users`. One row per person. Auto-created by the `handle_new_user` trigger on signup/invite, reading `full_name`/`role` out of the new user's metadata (defaults to `role = 'installer'` if not specified).
- **`clients`** — the customer. Not the same as a `profiles` row (clients don't log in).
- **`service_calls`** — the core entity. `job_number` is **intentionally non-unique** — the same job can have multiple service calls over time (this mirrors the real paper workflow it replaced). Don't add a uniqueness constraint on it.
- **`attachments`** — photos/videos, stored in the private Supabase Storage bucket `service-call-media`, one row per file. `phase` is `'reported'` (office/customer photos) or `'resolution'` (installer's after-photos). Access is via **signed URLs only** (1-hour TTL, see `getSignedUrl` in `src/lib/api.ts`) — the bucket is never public.
- **`service_call_notes`** — a note thread on a call. `visibility` is `'shared'` (everyone who can see the call) or `'internal'` (office/admin only — installers cannot post or read internal notes).
- **`notification_log`** — an audit trail of every email attempt (sent or failed), written by the `send-notification` edge function, not by the client directly.

### 3a. Customer Service Log (office/admin only, always tied to a job)

Added after Milestone 1 shipped — an internal ticket log of customer service communications. Per the client (confirmed over chat, see project history if you need the exact wording): **"Always related to a job, and its just internal so we can keep track of every request."** This is NOT a general/standalone communications log and NOT client-facing — there are no client accounts, and nothing here is ever communicated *through* the portal. Office/admin log that "client X called about job #Y," track it like a ticket (open → updates → closed), and that's it.

- **`customer_communications`** — `service_call_id` is a **required** FK to `service_calls` (`ON DELETE CASCADE`). There is no separate customer name/phone/email on this table — the client's identity comes from `service_call.client_id`, not duplicated here. `method` (`phone`/`email`/`text`/`in_person`/`other`), `status` (`open`/`in_progress`/`resolved`/`closed`), `handled_by` (a `profiles` id, must be admin/office).
- **`communication_notes`** — a timestamped update thread per ticket, same shape as `service_call_notes` but **no shared/internal split** — the whole table is already office/admin-only, so there's nothing to split visibility between.
- **No email is sent for this feature.** Don't wire it into `send-notification`/`notification_log` unless asked.
- **Installers get zero access** — not just hidden nav, there is no RLS policy for `installer` on either table at all, and RLS defaults to deny. See `supabase/migrations/20260922000000_customer_communications_log.sql`.
- **Two entry points, same data**: a standalone "Communications" tab in `OfficePortal.tsx` (visible to both office and admin, unlike "Team" which is admin-only) listing every ticket across all jobs, *and* a "Log Customer Service" button directly on `CallDetailOffice.tsx` that opens the same create modal pre-filled with that job (`presetServiceCallId`, locked so it can't be changed). Keep both in sync if you touch the create flow.
- UI lives in `src/components/office/{CommunicationsTable,CommunicationDetail,CreateCommunicationModal}.tsx`.

---

## 4. Events — what each one actually means

These are the `eventType` values used in notifications (`notification_log.event_type`, and the `send-notification` edge function payload):

| Event | Fired when | Who receives the email |
|---|---|---|
| `new_call` | Office creates a call with an installer already assigned | The assigned installer |
| `reassigned` | Office changes `installer_id` on an existing call to someone new | The **new** installer |
| `completed` | Installer marks their call complete via `installer_complete_call` | Office (hardcoded to `office@everlastbathrooms.com` — see §6) |
| `blocked` | Installer marks their call blocked (with a required reason) | Office (same hardcoded address) |
| `updated`, `overdue` | Defined in the schema/edge-function types for forward-compatibility with later milestones. **Not currently dispatched by any code path.** Don't assume they fire. |

Call **statuses** (`service_calls.status`) are a different thing from events — `open`, `in_progress`, `blocked`, `completed`, `cancelled`. An event is a thing that *happened*; a status is the call's *current state*.

---

## 5. App flow, end to end

1. **Login** (`src/components/auth/LoginView.tsx`) — plain email/password against Supabase Auth. No self-signup; accounts only come from an admin invite.
2. **Invite** (admin-only, `src/components/office/InviteCrewModal.tsx` → `invite-crew` edge function) — creates the `auth.users` row via the Auth Admin API and sends Supabase's built-in invite email. The `handle_new_user` trigger creates their `profiles` row automatically from the invite metadata.
3. **First login after invite** — the invite email link redirects back to the app with `type=invite` in the URL. `src/App.tsx` detects this *before* rendering any portal and forces `src/components/auth/SetPasswordView.tsx` — the user cannot reach any screen (and therefore cannot get "locked out with no password") until they set one. Same mechanism handles `type=recovery` from the "Forgot password?" flow.
4. **Office creates a service call** (`CreateCallModal` → `api.createServiceCall`) — inserts the row, uploads any attached files, and (if an installer is assigned) fires `dispatchNotification` → `new_call` email.
5. **Installer views their calls** (`InstallerPortal` → `api.getServiceCalls`) — RLS does the filtering; the client does not filter by `installer_id` itself.
6. **Installer completes/blocks a call** (`CallDetail` → `CompleteModal`/`BlockedModal` → `api.installerCompleteCall`) — calls the RPC, optionally adds a note, uploads "after" photos, then fires `dispatchOfficeNotification` → `completed`/`blocked` email to the office inbox.
7. **Office reassigns a call** (`CallDetailOffice` → `api.updateServiceCall`) — if `installer_id` actually changed, fires `dispatchNotification` → `reassigned` email to the new installer.

All email actually goes out through the **`send-notification`** edge function (holds the Resend API key server-side — never put that key in client code). All of it is fire-and-forget from the client's perspective: a failed email never blocks the underlying database action, and is logged (success or failure) to `notification_log`.

---

## 6. Things that are hardcoded on purpose — don't "fix" them into config without asking

- Office notification recipient is the literal string `office@everlastbathrooms.com` in `dispatchOfficeNotification` (`src/lib/api.ts`). There's no UI to change it. If the client wants this configurable, that's a real feature request, not a bug.
- `RESEND_FROM_EMAIL` must be on a domain verified in Resend, or every send silently fails at the Resend API level (shows up as `status = 'failed'` in `notification_log`, not as a client-visible error).

---

## 7. Milestone 1 scope — what is deliberately NOT here

This build intentionally excludes pieces from the original full spec. Don't add them back in without the client asking:

- **90-day service-call-rate dashboard** and `installer_monthly_stats` (the "Service Call %" metric) — cut because it depended on a Projects module that was also cut.
- **Full projects tracking** — not built.
- **45-day attachment deletion / Google Drive export** — not built; everything is kept indefinitely in Supabase Storage.
- **Spanish interface toggle** — not built (note *content* has always supported any language; this is about UI labels).
- **CSV export button removed** — was in an earlier draft, not in this milestone's `ServiceCallsTable`.

If you're asked to add one of these, treat it as new scope, not a bug fix — check with the user about how it should work before building, the same way the original spec required a sign-off in §1 before implementation.

---

## 8. Known infrastructure gotchas (already fixed once — don't reintroduce)

- **`SECURITY DEFINER` functions need `SET search_path = public`** and fully-qualified names (`public.profiles`, `public.user_role`, etc.). Without it, `handle_new_user` fails with `relation "profiles" does not exist` because the trigger runs in GoTrue's execution context, which doesn't have `public` on its search path. All three functions in `schema.sql` (`handle_new_user`, `auth_role`, `installer_complete_call`) already do this — keep the pattern for any new one.
- **`pg_trgm` extension must be created before any index that uses `gin_trgm_ops`** — it's at the very top of `schema.sql`, before the `clients` table. Don't move it later in the file.
- **Edge functions need explicit CORS handling** (`supabase/functions/_shared/cors.ts`). Without it, a browser call via `supabase.functions.invoke` fails at the `OPTIONS` preflight with the unhelpful "Failed to send a request to the Edge Function" — looks like a deploy problem, isn't.
- **Use `supabase/functions/_shared/keys.ts`**, not `Deno.env.get('SUPABASE_ANON_KEY')` / `SUPABASE_SERVICE_ROLE_KEY'` directly — Supabase has moved to `SUPABASE_PUBLISHABLE_KEYS` / `SUPABASE_SECRET_KEYS` as JSON dictionaries. The helper handles both formats.
- **Raw Postgres/Supabase error messages are not shown to users directly.** Route them through `friendlyDbError()` / `describeFunctionError()` in `src/lib/api.ts` — add new constraint names to `CONSTRAINT_MESSAGES` there instead of letting `violates check constraint "..."` reach the UI.

---

## 9. File map

```
src/
  App.tsx                        session/auth-flow routing (login / set-password / installer vs office)
  lib/
    supabase.ts                  Supabase client init (browser)
    api.ts                       ALL Supabase queries + mutations + error translation + email dispatch
    utils.ts                     formatting helpers, CSV export, status/priority display helpers
  types/index.ts                 shared TS types, mirrors the DB schema in camelCase
  components/
    auth/                        LoginView, SetPasswordView
    installer/                   phone-first views: list, detail, complete/blocked modals
    office/                      desktop views: table, detail, create-call, invite, team,
                                  communications log (table, detail, create modal)
    common/                      MediaLightbox (shared photo/video viewer)

supabase/
  schema.sql                     the full "fresh setup" reference — every table, RLS policy,
                                  RPC, and trigger, kept in sync with migrations/ below
  migrations/                    incremental diffs for an already-running project
                                  (`supabase db push`) — schema.sql already has the same DDL,
                                  don't let the two drift apart
  functions/
    _shared/                     cors.ts, keys.ts — reused by every edge function
    invite-crew/                 admin-only: creates a user via Auth Admin API
    send-notification/           sends email via Resend, logs to notification_log
```

---

## 10. Ground rules for future changes

- **RLS first.** Any new table gets `ENABLE ROW LEVEL SECURITY` and explicit policies before it gets a UI. "The UI won't let you" is not a security boundary.
- **Don't reintroduce mock/demo data, a phone simulator, or a role switcher.** Those existed in an early localStorage prototype and were deliberately removed when this was wired to real Supabase — see git history if you need to understand why.
- **Keep error messages human-readable** (§8, last bullet) — extend the existing translation maps rather than letting raw driver errors leak to a `alert()`.
- **New email events** go through the existing `send-notification` function and `notification_log` table — add the event type to the `CHECK` constraint in `schema.sql` *and* to the edge function's `EventType` union, not just one of the two.
- **Ask before expanding scope.** If a request sounds like it belongs to §7's excluded list, or changes a hardcoded value in §6, confirm with the user first rather than guessing at what they'd want.
- **New database changes get both a migration file** (`supabase/migrations/<timestamp>_description.sql`, applied incrementally to the live project) **and the same DDL appended to `schema.sql`** (the from-scratch reference). Keep them in sync — don't add one without the other.
