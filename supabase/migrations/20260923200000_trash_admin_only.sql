-- Everlast Bathrooms — Restrict Trash to admins only
--
-- The Trash view was already hidden from office/installer in the UI, but
-- two gaps remained at the database level:
--   1. SELECT: office had unrestricted read on service_calls/
--      customer_communications, so a soft-deleted row was still visible to
--      them via a direct query (e.g. through devtools) even though the UI
--      never showed it.
--   2. UPDATE: soft-delete/restore just wrote deleted_at/deleted_by through
--      the existing broad "office and admin update" policies, so office
--      could technically call those writes directly too, even though only
--      admins ever see the button.
--
-- Fix: office's SELECT is now scoped to deleted_at IS NULL (only admin sees
-- deleted rows at all), and soft-delete/restore move into SECURITY DEFINER
-- RPCs that check auth_role() = 'admin' themselves and stamp deleted_by
-- from auth.uid() server-side — the same pattern already used for
-- installer_complete_call.
--
-- Apply with: supabase db push
-- (or paste directly into the Supabase SQL Editor)

-- service_calls: admin sees everything (including deleted, for Trash);
-- office only sees non-deleted; installers only their own non-deleted.
DROP POLICY IF EXISTS "installers read own calls" ON service_calls;
CREATE POLICY "installers read own calls"
ON service_calls FOR SELECT
USING (
  auth_role() = 'admin'
  OR (auth_role() = 'office' AND deleted_at IS NULL)
  OR (installer_id = auth.uid() AND deleted_at IS NULL)
);

-- customer_communications: same split.
DROP POLICY IF EXISTS "office and admin read communications" ON customer_communications;
CREATE POLICY "office and admin read communications" ON customer_communications FOR SELECT
USING (
  auth_role() = 'admin'
  OR (auth_role() = 'office' AND deleted_at IS NULL)
);

-- Soft-delete / restore RPCs: admin-only, enforced inside the function
-- rather than relying on the broad office+admin UPDATE policy.
CREATE OR REPLACE FUNCTION public.soft_delete_service_call(p_call_id UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can delete a service call';
  END IF;

  UPDATE service_calls SET deleted_at = now(), deleted_by = auth.uid() WHERE id = p_call_id;
END $$;

CREATE OR REPLACE FUNCTION public.restore_service_call(p_call_id UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can restore a service call';
  END IF;

  UPDATE service_calls SET deleted_at = NULL, deleted_by = NULL WHERE id = p_call_id;
END $$;

CREATE OR REPLACE FUNCTION public.soft_delete_communication(p_id UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can delete a communication ticket';
  END IF;

  UPDATE customer_communications SET deleted_at = now(), deleted_by = auth.uid() WHERE id = p_id;
END $$;

CREATE OR REPLACE FUNCTION public.restore_communication(p_id UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can restore a communication ticket';
  END IF;

  UPDATE customer_communications SET deleted_at = NULL, deleted_by = NULL WHERE id = p_id;
END $$;
