-- Fix: allow client access by client_id OR client_name (handles both matching strategies)
DROP POLICY IF EXISTS "editorial_content_client_read" ON editorial_content;

CREATE POLICY "editorial_content_client_read" ON editorial_content
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE (c.portal_user_id = auth.uid() OR lower(c.contact_email) = lower(auth.email()))
      AND (
        lower(c.company_name) = lower(editorial_content.client_name)
        OR c.id = editorial_content.client_id
      )
    )
  );
