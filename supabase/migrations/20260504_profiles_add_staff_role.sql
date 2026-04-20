-- Add 'staff' to the allowed roles in profiles table.
-- Without this, setStaffPassword's profile upsert violates profiles_role_check
-- and the staff user ends up with no role, so App.jsx signs them out on login.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['admin'::text, 'freelancer'::text, 'user'::text, 'client'::text, 'staff'::text]));
