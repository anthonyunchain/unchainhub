-- Allow freelancers to update their own profile row
CREATE POLICY "freelancers_self_update" ON freelancers
  FOR UPDATE USING (
    email = auth.email()
  )
  WITH CHECK (
    email = auth.email()
  );
