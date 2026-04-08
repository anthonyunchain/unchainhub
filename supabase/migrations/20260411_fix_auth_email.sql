-- Fix current_freelancer_id() to use auth.email() instead of querying auth.users directly
CREATE OR REPLACE FUNCTION current_freelancer_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM freelancers
  WHERE email = auth.email()
  LIMIT 1;
$$;

-- Recreate the project update policy using auth.email() for the name fallback
DROP POLICY IF EXISTS "projects_freelancer_update" ON projects;

CREATE POLICY "projects_freelancer_update" ON projects
  FOR UPDATE USING (
    freelancer_id = current_freelancer_id()
    OR (
      freelancer_name IS NOT NULL
      AND freelancer_name <> ''
      AND lower(trim(freelancer_name)) = (
        SELECT lower(trim(coalesce(name, '')))
        FROM freelancers
        WHERE email = auth.email()
        LIMIT 1
      )
    )
  );
