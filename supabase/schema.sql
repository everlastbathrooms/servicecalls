-- Everlast Bathrooms — Service Call Portal
-- Milestone 1 Database Schema & Row-Level Security (RLS)
-- Run this in your Supabase Dashboard > SQL Editor

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Enums (idempotent)
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'office', 'installer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE call_priority AS ENUM ('low', 'mid', 'high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE call_status AS ENUM ('open', 'in_progress', 'blocked', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE responsibility AS ENUM ('installer', 'office', 'manufacturer', 'client', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE billing_type AS ENUM ('unpaid', 'paid', 'undecided');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE attachment_kind AS ENUM ('image', 'video', 'document');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE attachment_phase AS ENUM ('reported', 'resolution');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE note_visibility AS ENUM ('shared', 'internal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL CHECK (length(full_name) BETWEEN 2 AND 120),
  role user_role NOT NULL DEFAULT 'installer',
  email TEXT NOT NULL UNIQUE,
  phone TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notify_by_email BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role_active ON profiles (role) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles (email);

-- Auto-create a profile row when a new auth user signs up.
-- Role/full_name default here; an admin should update them via the dashboard
-- or a follow-up UPDATE after inviting a crew member.
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  safe_full_name TEXT;
  safe_role public.user_role;
BEGIN
  -- Guard against a blank/too-short name failing the profiles CHECK constraint.
  safe_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
  IF safe_full_name IS NULL OR length(safe_full_name) < 2 THEN
    safe_full_name := NEW.email;
  END IF;

  -- Guard against an invalid/unexpected role value failing the enum cast.
  BEGIN
    safe_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'installer');
  EXCEPTION WHEN OTHERS THEN
    safe_role := 'installer';
  END;

  INSERT INTO public.profiles (id, full_name, role, email)
  VALUES (NEW.id, safe_full_name, safe_role, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN unique_violation THEN
  -- A profile with this email already exists (e.g. a re-invite / retry);
  -- don't block auth.users creation over it.
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 3. Clients
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(name) >= 2),
  phone TEXT NULL,
  email TEXT NULL,
  address TEXT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_name ON clients USING gin (name gin_trgm_ops);

-- 4. Service Calls (the core table)
CREATE TABLE IF NOT EXISTS service_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number TEXT NOT NULL CHECK (length(job_number) BETWEEN 1 AND 30),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  installer_id UUID NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  reported_date DATE NOT NULL DEFAULT CURRENT_DATE,
  install_date DATE NULL,
  priority call_priority NOT NULL DEFAULT 'low',
  description TEXT NOT NULL CHECK (length(description) BETWEEN 3 AND 4000),
  responsibility responsibility NOT NULL DEFAULT 'installer',
  billing billing_type NOT NULL DEFAULT 'undecided',
  status call_status NOT NULL DEFAULT 'open',
  completion_note TEXT NULL,
  completed_at TIMESTAMPTZ NULL,
  completed_by UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
  due_date DATE NULL,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT completed_fields_present CHECK (
    (status <> 'completed')
    OR (completed_at IS NOT NULL AND completed_by IS NOT NULL)
  ),
  CONSTRAINT blocked_needs_reason CHECK (
    status <> 'blocked' OR (completion_note IS NOT NULL AND length(completion_note) > 0)
  ),
  CONSTRAINT install_before_report CHECK (
    install_date IS NULL OR install_date <= reported_date
  )
);

CREATE INDEX IF NOT EXISTS idx_service_calls_installer_status ON service_calls (installer_id, status);
CREATE INDEX IF NOT EXISTS idx_service_calls_reported_desc ON service_calls (reported_date DESC);
CREATE INDEX IF NOT EXISTS idx_service_calls_open ON service_calls (status) WHERE status <> 'completed';
CREATE INDEX IF NOT EXISTS idx_service_calls_job_number ON service_calls (job_number);
CREATE INDEX IF NOT EXISTS idx_service_calls_client ON service_calls (client_id);

-- 5. Attachments
CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_call_id UUID NOT NULL REFERENCES service_calls(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 104857600),
  kind attachment_kind NOT NULL,
  phase attachment_phase NOT NULL DEFAULT 'reported',
  uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attachments_call_phase ON attachments (service_call_id, phase);

-- 6. Service Call Notes
CREATE TABLE IF NOT EXISTS service_call_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_call_id UUID NOT NULL REFERENCES service_calls(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  visibility note_visibility NOT NULL DEFAULT 'shared',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_call_time ON service_call_notes (service_call_id, created_at DESC);

-- 7. Notification Log
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_call_id UUID REFERENCES service_calls(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('new_call','updated','reassigned','overdue','completed','blocked')),
  provider_id TEXT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  error TEXT NULL,
  sent_at TIMESTAMPTZ NULL,
  created_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unq_notification_day UNIQUE (service_call_id, recipient_email, event_type, created_date)
);

-- 8. Row-Level Security (RLS) — database-level installer isolation
CREATE OR REPLACE FUNCTION public.auth_role() RETURNS public.user_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_call_notes ENABLE ROW LEVEL SECURITY;

-- profiles: everyone signed in can read profiles (needed for assignment dropdowns
-- and displaying installer names); only admin/office can write.
DROP POLICY IF EXISTS "read all profiles" ON profiles;
CREATE POLICY "read all profiles" ON profiles FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "admin office manage profiles" ON profiles;
CREATE POLICY "admin office manage profiles" ON profiles FOR UPDATE
USING (auth_role() IN ('admin', 'office'));

-- clients: readable by anyone signed in; writable by admin/office.
DROP POLICY IF EXISTS "read all clients" ON clients;
CREATE POLICY "read all clients" ON clients FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "office and admin insert clients" ON clients;
CREATE POLICY "office and admin insert clients" ON clients FOR INSERT
WITH CHECK (auth_role() IN ('admin', 'office'));

-- service_calls: installers see only their own rows; admin/office see all.
DROP POLICY IF EXISTS "installers read own calls" ON service_calls;
CREATE POLICY "installers read own calls"
ON service_calls FOR SELECT
USING (
  auth_role() IN ('admin', 'office')
  OR installer_id = auth.uid()
);

DROP POLICY IF EXISTS "office and admin insert" ON service_calls;
CREATE POLICY "office and admin insert"
ON service_calls FOR INSERT
WITH CHECK (auth_role() IN ('admin', 'office'));

DROP POLICY IF EXISTS "office and admin update anything" ON service_calls;
CREATE POLICY "office and admin update anything"
ON service_calls FOR UPDATE
USING (auth_role() IN ('admin', 'office'));

-- deleting a call is destructive (cascades to its attachments and notes),
-- so it's restricted to admins only, unlike insert/update above.
DROP POLICY IF EXISTS "admin delete calls" ON service_calls;
CREATE POLICY "admin delete calls"
ON service_calls FOR DELETE
USING (auth_role() = 'admin');

-- attachments: visible to anyone who can see the parent call; anyone signed in can upload.
DROP POLICY IF EXISTS "read attachments of visible calls" ON attachments;
CREATE POLICY "read attachments of visible calls" ON attachments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM service_calls sc
    WHERE sc.id = attachments.service_call_id
      AND (auth_role() IN ('admin', 'office') OR sc.installer_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "insert attachments on visible calls" ON attachments;
CREATE POLICY "insert attachments on visible calls" ON attachments FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM service_calls sc
    WHERE sc.id = attachments.service_call_id
      AND (auth_role() IN ('admin', 'office') OR sc.installer_id = auth.uid())
  )
);

-- service_call_notes: same visibility rule as attachments; installers only post 'shared' notes.
DROP POLICY IF EXISTS "read notes of visible calls" ON service_call_notes;
CREATE POLICY "read notes of visible calls" ON service_call_notes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM service_calls sc
    WHERE sc.id = service_call_notes.service_call_id
      AND (auth_role() IN ('admin', 'office') OR sc.installer_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "insert notes on visible calls" ON service_call_notes;
CREATE POLICY "insert notes on visible calls" ON service_call_notes FOR INSERT
WITH CHECK (
  author_id = auth.uid()
  AND (
    auth_role() IN ('admin', 'office')
    OR (
      visibility = 'shared'
      AND EXISTS (
        SELECT 1 FROM service_calls sc
        WHERE sc.id = service_call_notes.service_call_id AND sc.installer_id = auth.uid()
      )
    )
  )
);

-- 9. RPC: installer_complete_call (Section 5.11) — the only write path
-- installers have on service_calls: status in ('completed','blocked','in_progress'),
-- and a blocked call must carry a reason note.
CREATE OR REPLACE FUNCTION public.installer_complete_call(
  p_call_id UUID,
  p_status public.call_status,
  p_note TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('completed', 'blocked', 'in_progress') THEN
    RAISE EXCEPTION 'Installers cannot set status %', p_status;
  END IF;

  IF p_status = 'blocked' AND (p_note IS NULL OR length(trim(p_note)) = 0) THEN
    RAISE EXCEPTION 'A reason note is required when marking a call blocked';
  END IF;

  UPDATE public.service_calls
     SET status          = p_status,
         completion_note = COALESCE(p_note, completion_note),
         completed_at    = CASE WHEN p_status = 'completed' THEN now() ELSE completed_at END,
         completed_by    = CASE WHEN p_status = 'completed' THEN auth.uid() ELSE completed_by END,
         updated_at      = now()
   WHERE id = p_call_id
     AND installer_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Call not found or not assigned to you';
  END IF;
END $$;

-- 10. Storage bucket for photos/videos (private; access via signed URLs only)
INSERT INTO storage.buckets (id, name, public)
VALUES ('service-call-media', 'service-call-media', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "read media of visible calls" ON storage.objects;
CREATE POLICY "read media of visible calls" ON storage.objects FOR SELECT
USING (
  bucket_id = 'service-call-media'
  AND EXISTS (
    SELECT 1 FROM service_calls sc
    WHERE sc.id::text = (storage.foldername(name))[1]
      AND (auth_role() IN ('admin', 'office') OR sc.installer_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "upload media on visible calls" ON storage.objects;
CREATE POLICY "upload media on visible calls" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'service-call-media'
  AND EXISTS (
    SELECT 1 FROM service_calls sc
    WHERE sc.id::text = (storage.foldername(name))[1]
      AND (auth_role() IN ('admin', 'office') OR sc.installer_id = auth.uid())
  )
);


-- =====================================================================
-- Customer Service Log (office/admin only, always tied to a job — see
-- migrations/20260922000000_customer_communications_log.sql for the
-- standalone diff applied to an already-running project via
-- `supabase db push`)
-- =====================================================================

-- 1. Enums (idempotent)
DO $$ BEGIN
  CREATE TYPE communication_method AS ENUM ('phone', 'email', 'text', 'in_person', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE communication_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. customer_communications — one row per logged customer service ticket.
-- Always tied to a job; the client's name/phone/address come from the
-- linked service_calls -> clients chain, so they are not duplicated here.
CREATE TABLE IF NOT EXISTS customer_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_call_id UUID NOT NULL REFERENCES service_calls(id) ON DELETE CASCADE,
  date_received DATE NOT NULL DEFAULT CURRENT_DATE,
  method communication_method NOT NULL,
  status communication_status NOT NULL DEFAULT 'open',
  handled_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  summary TEXT NOT NULL CHECK (length(summary) BETWEEN 3 AND 1000),
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comms_service_call ON customer_communications (service_call_id);
CREATE INDEX IF NOT EXISTS idx_comms_date_received ON customer_communications (date_received DESC);
CREATE INDEX IF NOT EXISTS idx_comms_status_open ON customer_communications (status) WHERE status <> 'closed';
CREATE INDEX IF NOT EXISTS idx_comms_handled_by ON customer_communications (handled_by);

-- 3. communication_notes — append-only, timestamped update thread per
-- ticket. No shared/internal split (unlike service_call_notes) since this
-- whole table is already office/admin-only.
CREATE TABLE IF NOT EXISTS communication_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id UUID NOT NULL REFERENCES customer_communications(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comm_notes_comm_time ON communication_notes (communication_id, created_at DESC);

-- 4. Row-Level Security — office/admin only, full stop. No policy exists
-- for 'installer' or any client-facing role; RLS defaults to deny.
ALTER TABLE customer_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "office and admin read communications" ON customer_communications;
CREATE POLICY "office and admin read communications" ON customer_communications FOR SELECT
USING (auth_role() IN ('admin', 'office'));

DROP POLICY IF EXISTS "office and admin insert communications" ON customer_communications;
CREATE POLICY "office and admin insert communications" ON customer_communications FOR INSERT
WITH CHECK (auth_role() IN ('admin', 'office'));

DROP POLICY IF EXISTS "office and admin update communications" ON customer_communications;
CREATE POLICY "office and admin update communications" ON customer_communications FOR UPDATE
USING (auth_role() IN ('admin', 'office'));

-- Deleting a ticket is destructive (cascades to its notes), so — unlike
-- read/insert/update above — it's restricted to admins only.
DROP POLICY IF EXISTS "admin delete communications" ON customer_communications;
CREATE POLICY "admin delete communications" ON customer_communications FOR DELETE
USING (auth_role() = 'admin');

DROP POLICY IF EXISTS "office and admin read communication notes" ON communication_notes;
CREATE POLICY "office and admin read communication notes" ON communication_notes FOR SELECT
USING (auth_role() IN ('admin', 'office'));

DROP POLICY IF EXISTS "office and admin insert communication notes" ON communication_notes;
CREATE POLICY "office and admin insert communication notes" ON communication_notes FOR INSERT
WITH CHECK (
  author_id = auth.uid()
  AND auth_role() IN ('admin', 'office')
);

-- 5. Keep updated_at current on any edit (status change, reassign handler, etc.)
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS set_customer_communications_updated_at ON customer_communications;
CREATE TRIGGER set_customer_communications_updated_at
  BEFORE UPDATE ON customer_communications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
