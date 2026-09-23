-- Everlast Bathrooms — Customer Service Log
-- Make communications survive independently of the service call they were
-- logged against. Deleting a work order (service_calls row) previously
-- CASCADE-deleted every communication ticket tied to it, which silently
-- wiped customer service history along with the job — reported after an
-- admin deleted 2 work orders and saw their logged tickets disappear too.
--
-- Fix: service_call_id becomes nullable with ON DELETE SET NULL instead of
-- CASCADE, and job_number/client name/phone are snapshotted onto the
-- communication row at creation time (via trigger) so the ticket keeps its
-- context even after the job is deleted.
--
-- Apply with: supabase db push
-- (or paste directly into the Supabase SQL Editor)

ALTER TABLE customer_communications ALTER COLUMN service_call_id DROP NOT NULL;

ALTER TABLE customer_communications
  DROP CONSTRAINT IF EXISTS customer_communications_service_call_id_fkey;

ALTER TABLE customer_communications
  ADD CONSTRAINT customer_communications_service_call_id_fkey
  FOREIGN KEY (service_call_id) REFERENCES service_calls(id) ON DELETE SET NULL;

ALTER TABLE customer_communications ADD COLUMN IF NOT EXISTS job_number_snapshot TEXT;
ALTER TABLE customer_communications ADD COLUMN IF NOT EXISTS client_name_snapshot TEXT;
ALTER TABLE customer_communications ADD COLUMN IF NOT EXISTS client_phone_snapshot TEXT;

-- Backfill snapshots for existing tickets from their still-linked job/client.
UPDATE customer_communications cc
SET job_number_snapshot = sc.job_number,
    client_name_snapshot = c.name,
    client_phone_snapshot = c.phone
FROM service_calls sc
JOIN clients c ON c.id = sc.client_id
WHERE cc.service_call_id = sc.id AND cc.job_number_snapshot IS NULL;

-- Auto-populate the snapshot on every new ticket, so application code never
-- has to remember to do it (and it stays correct even if the job's client
-- or job number changes later).
CREATE OR REPLACE FUNCTION public.snapshot_communication_job_info() RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.service_call_id IS NOT NULL THEN
    SELECT sc.job_number, c.name, c.phone
    INTO NEW.job_number_snapshot, NEW.client_name_snapshot, NEW.client_phone_snapshot
    FROM service_calls sc
    JOIN clients c ON c.id = sc.client_id
    WHERE sc.id = NEW.service_call_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS snapshot_communication_job_info_trigger ON customer_communications;
CREATE TRIGGER snapshot_communication_job_info_trigger
  BEFORE INSERT ON customer_communications
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_communication_job_info();
