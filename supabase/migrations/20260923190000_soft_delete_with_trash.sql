-- Everlast Bathrooms — Soft delete for service calls and communications
-- Requested after a hard-deleted work order couldn't be recovered (Free
-- plan has no backups/PITR). "Delete" no longer removes the row — it stamps
-- deleted_at/deleted_by and the row disappears from normal views but stays
-- fully intact and recoverable from a new admin-only Trash view.
--
-- Apply with: supabase db push
-- (or paste directly into the Supabase SQL Editor)

ALTER TABLE service_calls ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
ALTER TABLE service_calls ADD COLUMN IF NOT EXISTS deleted_by UUID NULL REFERENCES profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_service_calls_deleted_at ON service_calls (deleted_at);

ALTER TABLE customer_communications ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
ALTER TABLE customer_communications ADD COLUMN IF NOT EXISTS deleted_by UUID NULL REFERENCES profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_comms_deleted_at ON customer_communications (deleted_at);

-- Installers must never see a soft-deleted call, even in their own list.
-- Admin/office keep unrestricted SELECT so the Trash view can find deleted
-- rows; the app filters deleted_at IS NULL for their normal list views.
DROP POLICY IF EXISTS "installers read own calls" ON service_calls;
CREATE POLICY "installers read own calls"
ON service_calls FOR SELECT
USING (
  auth_role() IN ('admin', 'office')
  OR (installer_id = auth.uid() AND deleted_at IS NULL)
);
