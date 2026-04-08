-- Allow authenticated users to read admin profile IDs (needed to send notifications to admins)
CREATE POLICY "profiles_admin_id_read" ON profiles
  FOR SELECT USING (role = 'admin');
