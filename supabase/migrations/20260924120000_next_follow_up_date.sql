-- Everlast Bathrooms — Next Follow-Up Date
-- Lets office/admin flag when a work order or a customer service ticket
-- next needs attention, so the tables can be sorted/prioritized by it.
--
-- service_calls already had an unused due_date column (never wired to any
-- UI or write path) — renamed rather than adding a redundant one, since no
-- existing row has ever had it set. customer_communications gets a new
-- matching column.
--
-- Apply with: supabase db push
-- (or paste directly into the Supabase SQL Editor)

ALTER TABLE service_calls RENAME COLUMN due_date TO next_follow_up_date;
CREATE INDEX IF NOT EXISTS idx_service_calls_follow_up
  ON service_calls (next_follow_up_date) WHERE next_follow_up_date IS NOT NULL;

ALTER TABLE customer_communications ADD COLUMN IF NOT EXISTS next_follow_up_date DATE NULL;
CREATE INDEX IF NOT EXISTS idx_comms_follow_up
  ON customer_communications (next_follow_up_date) WHERE next_follow_up_date IS NOT NULL;
