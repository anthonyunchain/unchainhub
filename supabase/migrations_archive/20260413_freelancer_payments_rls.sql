-- Enable RLS on freelancer_payments (was unrestricted)
ALTER TABLE freelancer_payments ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "freelancer_payments_admin_all" ON freelancer_payments
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Freelancers can only read their own payments
CREATE POLICY "freelancer_payments_own_read" ON freelancer_payments
  FOR SELECT TO authenticated
  USING (
    freelancer_id IN (
      SELECT id FROM freelancers WHERE user_id = auth.uid()
    )
  );
