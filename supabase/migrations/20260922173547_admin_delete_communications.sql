-- Everlast Bathrooms — Customer Service Log
-- Lets an admin delete a logged ticket. Deleting is destructive (cascades
-- to communication_notes via ON DELETE CASCADE), so — unlike the existing
-- read/insert/update policies, which are office+admin — this is
-- admin-only, matching the same "admin delete calls" pattern already used
-- on service_calls.
--
-- Apply with: supabase db push
-- (or paste directly into the Supabase SQL Editor)

DROP POLICY IF EXISTS "admin delete communications" ON customer_communications;
CREATE POLICY "admin delete communications" ON customer_communications FOR DELETE
USING (auth_role() = 'admin');
