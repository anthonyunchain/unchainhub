-- Allow freelancers to update their own profile row (matched by auth user_id)
DROP POLICY IF EXISTS "freelancers_self_update" ON freelancers;
CREATE POLICY "freelancers_self_update" ON freelancers
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
