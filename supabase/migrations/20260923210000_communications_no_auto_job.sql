-- Everlast Bathrooms — Customer Service Log
-- Logging a ticket for a client with no existing job was silently creating
-- a brand-new service_calls row just to satisfy the old "every
-- communication needs a job" requirement — reported as an unwanted "phantom
-- work order" showing up on the Service Calls table. Communications are
-- meant to be independent of service calls (already true for delete, per
-- the 2026-09-23 cascade fix); they should be independent at creation too.
--
-- Fix: give customer_communications a direct client_id (nullable, same
-- ON DELETE SET NULL / snapshot pattern as service_call_id), so a ticket
-- can be logged against a client alone, with no job involved at all. A
-- ticket started from a specific job's "Log Customer Service" button still
-- links service_call_id — that's a deliberate, explicit correlation the
-- user initiates, not an auto-created one, so it's untouched.
--
-- Apply with: supabase db push
-- (or paste directly into the Supabase SQL Editor)

ALTER TABLE customer_communications ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_comms_client ON customer_communications (client_id);

-- Backfill client_id for existing rows from their linked job's client.
UPDATE customer_communications cc
SET client_id = sc.client_id
FROM service_calls sc
WHERE cc.service_call_id = sc.id AND cc.client_id IS NULL;

-- Extend the snapshot trigger: when there's a job, behave exactly as
-- before (and also backfill client_id from it); when there's only a
-- client_id (no job), snapshot the client's name/phone directly.
CREATE OR REPLACE FUNCTION public.snapshot_communication_job_info() RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.service_call_id IS NOT NULL THEN
    SELECT sc.job_number, sc.client_id, c.name, c.phone
    INTO NEW.job_number_snapshot, NEW.client_id, NEW.client_name_snapshot, NEW.client_phone_snapshot
    FROM service_calls sc
    JOIN clients c ON c.id = sc.client_id
    WHERE sc.id = NEW.service_call_id;
  ELSIF NEW.client_id IS NOT NULL THEN
    SELECT c.name, c.phone
    INTO NEW.client_name_snapshot, NEW.client_phone_snapshot
    FROM clients c
    WHERE c.id = NEW.client_id;
  END IF;
  RETURN NEW;
END $$;
