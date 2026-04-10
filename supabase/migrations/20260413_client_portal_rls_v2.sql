-- Client portal: add portal_user_id column and RLS policies

-- Add portal_user_id column to clients if it doesn't exist
ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS clients_portal_user_id_idx ON clients(portal_user_id);

-- Drop old email-based policies if they exist
DROP POLICY IF EXISTS "clients_read_own" ON clients;
DROP POLICY IF EXISTS "editorial_content_client_read" ON editorial_content;
DROP POLICY IF EXISTS "client_stats_client_read" ON client_stats;
DROP POLICY IF EXISTS "contracts_client_read" ON contracts;
DROP POLICY IF EXISTS "invoices_client_read" ON invoices;

-- Clients can read their own record via portal_user_id OR email fallback
CREATE POLICY "clients_read_own" ON clients
  FOR SELECT TO authenticated
  USING (
    portal_user_id = auth.uid()
    OR contact_email = auth.email()
  );

-- Editorial content: clients can only see their company's content
CREATE POLICY "editorial_content_client_read" ON editorial_content
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE (c.portal_user_id = auth.uid() OR c.contact_email = auth.email())
      AND c.company_name = editorial_content.client_name
    )
  );

-- Client stats
CREATE POLICY "client_stats_client_read" ON client_stats
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE (c.portal_user_id = auth.uid() OR c.contact_email = auth.email())
      AND c.company_name = client_stats.client_name
    )
  );

-- Contracts
CREATE POLICY "contracts_client_read" ON contracts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE (c.portal_user_id = auth.uid() OR c.contact_email = auth.email())
      AND c.company_name = contracts.client_name
    )
  );

-- Invoices
CREATE POLICY "invoices_client_read" ON invoices
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE (c.portal_user_id = auth.uid() OR c.contact_email = auth.email())
      AND c.company_name = invoices.client_name
    )
  );
