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

-- Security definer function: reads clients table bypassing its own RLS
CREATE OR REPLACE FUNCTION get_my_client_name()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT company_name FROM clients
  WHERE portal_user_id = auth.uid()
     OR contact_email = auth.email()
  LIMIT 1;
$$;

-- Clients can read & write their own briefs
CREATE POLICY "clients_own_monthly_briefs" ON monthly_briefs
  FOR ALL
  USING (client_name = get_my_client_name())
  WITH CHECK (client_name = get_my_client_name());

-- Staff/admin = authenticated user with no matching client record → reads all
CREATE POLICY "staff_read_all_monthly_briefs" ON monthly_briefs
  FOR SELECT
  USING (get_my_client_name() IS NULL);
