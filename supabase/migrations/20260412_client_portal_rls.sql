-- Client portal RLS policies
-- Clients can read their own record by email
CREATE POLICY "clients_read_own" ON clients
  FOR SELECT TO authenticated
  USING (contact_email = auth.email());

-- Clients can read editorial content for their company
CREATE POLICY "editorial_content_client_read" ON editorial_content
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.contact_email = auth.email()
      AND c.company_name = editorial_content.client_name
    )
  );

-- Clients can read their own stats
CREATE POLICY "client_stats_client_read" ON client_stats
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.contact_email = auth.email()
      AND c.company_name = client_stats.client_name
    )
  );

-- Clients can read their own contracts
CREATE POLICY "contracts_client_read" ON contracts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.contact_email = auth.email()
      AND c.company_name = contracts.client_name
    )
  );
