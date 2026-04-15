-- Company expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  date        date NOT NULL,
  description text NOT NULL,
  category    text NOT NULL DEFAULT 'Other',
  amount      numeric(12, 2) NOT NULL DEFAULT 0,
  receipt_url text,
  notes       text
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "expenses_admin_all" ON expenses
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
