-- Adds a "type of request" category to customer_communications so the
-- office can tell at a glance whether a ticket is about order status,
-- coordinating installation, or a project/scope question. Nullable at the
-- DB level (existing tickets are left blank rather than backfilled) —
-- required going forward is enforced by the app, not a NOT NULL constraint.

DO $$ BEGIN
  CREATE TYPE communication_request_type AS ENUM (
    'order_status',
    'installation_coordination',
    'project_scope',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE customer_communications
  ADD COLUMN IF NOT EXISTS request_type communication_request_type NULL;
