-- Fix: shootings_client_update_status policy referenced auth.users directly,
-- which the authenticated role can't read. This caused every UPDATE on
-- shootings (including admin's) to fail with "permission denied for table users".
-- Replace with auth.email(), same pattern used by shootings_client_read.

DROP POLICY IF EXISTS "shootings_client_update_status" ON public.shootings;

CREATE POLICY "shootings_client_update_status" ON public.shootings
  FOR UPDATE USING (
    client_name IN (
      SELECT company_name FROM public.clients
      WHERE portal_user_id = auth.uid()
         OR contact_email = auth.email()
    )
  )
  WITH CHECK (
    client_name IN (
      SELECT company_name FROM public.clients
      WHERE portal_user_id = auth.uid()
         OR contact_email = auth.email()
    )
  );
