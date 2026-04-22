-- Allow any authenticated user to read admin profiles.
-- Required for the New Conversation user picker — non-admin users need to see
-- admin profiles to initiate a DM.
CREATE POLICY "profiles_read_admins" ON profiles
  FOR SELECT TO authenticated
  USING (role = 'admin');
