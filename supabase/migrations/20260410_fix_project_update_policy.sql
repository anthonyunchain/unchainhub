-- Drop the old policy and replace with one that matches by ID OR name
DROP POLICY IF EXISTS "projects_freelancer_update" ON projects;

CREATE POLICY "projects_freelancer_update" ON projects
  FOR UPDATE USING (
    freelancer_id = current_freelancer_id()
    OR (
      lower(trim(coalesce(freelancer_name, ''))) = (
        SELECT lower(trim(coalesce(name, '')))
        FROM freelancers
        WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        LIMIT 1
      )
      AND freelancer_name IS NOT NULL
      AND freelancer_name <> ''
    )
  );
