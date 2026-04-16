-- Add client approval status and note to shootings
ALTER TABLE shootings ADD COLUMN IF NOT EXISTS client_status text NOT NULL DEFAULT 'Pending';
ALTER TABLE shootings ADD COLUMN IF NOT EXISTS client_note text;

-- Allow clients to update client_status on their own shootings
CREATE POLICY "shootings_client_update_status" ON shootings
  FOR UPDATE USING (
    client_name IN (
      SELECT company_name FROM clients
      WHERE portal_user_id = auth.uid()
         OR contact_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    client_name IN (
      SELECT company_name FROM clients
      WHERE portal_user_id = auth.uid()
         OR contact_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );
