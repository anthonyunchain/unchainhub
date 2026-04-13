-- Monthly briefs: clients fill a form once/month with upcoming content info
CREATE TABLE IF NOT EXISTS monthly_briefs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid,
  client_name text NOT NULL,
  month text NOT NULL,              -- yyyy-MM
  key_events text DEFAULT '',       -- key dates, events, launches
  campaigns text DEFAULT '',        -- active campaigns / promos
  themes text DEFAULT '',           -- main themes / topics
  products text DEFAULT '',         -- products / services to highlight
  notes text DEFAULT '',            -- anything else
  submitted_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_name, month)
);

ALTER TABLE monthly_briefs ENABLE ROW LEVEL SECURITY;

-- Clients can read & write their own briefs (matched by company_name)
CREATE POLICY "clients_own_monthly_briefs" ON monthly_briefs
  FOR ALL
  USING (
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

-- Admins can read all briefs
CREATE POLICY "admins_read_all_monthly_briefs" ON monthly_briefs
  FOR SELECT
  USING (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
  );
