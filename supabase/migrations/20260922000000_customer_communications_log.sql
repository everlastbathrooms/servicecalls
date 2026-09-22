-- Everlast Bathrooms — Customer Service Log
-- Office/admin-only feature: an internal ticket log of customer service
-- communications, ALWAYS tied to a specific job (service_calls row) — per
-- client: "Always related to a job, and its just internal so we can keep
-- track of every request." No client accounts, no client-facing
-- communication through the portal, no email notifications.
--
-- Apply with: supabase db push
-- (or paste directly into the Supabase SQL Editor)
--
-- NOTE: this supersedes an earlier draft of this table that linked loosely
-- to an optional client_id with free-text customer fields. That version was
-- never used in production, so this drops and recreates cleanly rather than
-- shipping an ALTER migration.
DROP TABLE IF EXISTS communication_notes;
DROP TABLE IF EXISTS customer_communications;

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
CREATE TABLE customer_communications (
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

CREATE INDEX idx_comms_service_call ON customer_communications (service_call_id);
CREATE INDEX idx_comms_date_received ON customer_communications (date_received DESC);
CREATE INDEX idx_comms_status_open ON customer_communications (status) WHERE status <> 'closed';
CREATE INDEX idx_comms_handled_by ON customer_communications (handled_by);

-- 3. communication_notes — append-only, timestamped update thread per
-- ticket. No shared/internal split (unlike service_call_notes) since this
-- whole table is already office/admin-only.
CREATE TABLE communication_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id UUID NOT NULL REFERENCES customer_communications(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comm_notes_comm_time ON communication_notes (communication_id, created_at DESC);

-- 4. Row-Level Security — office/admin only, full stop. No policy exists
-- for 'installer' or any client-facing role; RLS defaults to deny.
ALTER TABLE customer_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "office and admin read communications" ON customer_communications FOR SELECT
USING (auth_role() IN ('admin', 'office'));

CREATE POLICY "office and admin insert communications" ON customer_communications FOR INSERT
WITH CHECK (auth_role() IN ('admin', 'office'));

CREATE POLICY "office and admin update communications" ON customer_communications FOR UPDATE
USING (auth_role() IN ('admin', 'office'));

CREATE POLICY "office and admin read communication notes" ON communication_notes FOR SELECT
USING (auth_role() IN ('admin', 'office'));

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

CREATE TRIGGER set_customer_communications_updated_at
  BEFORE UPDATE ON customer_communications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
