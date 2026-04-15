-- Add per-freelancer editorial calendar visibility
ALTER TABLE freelancers ADD COLUMN IF NOT EXISTS editorial_client_names text[] DEFAULT '{}';

-- Drop old global policy, replace with per-freelancer policy
DROP POLICY IF EXISTS "editorial_content_freelancer_read" ON editorial_content;

CREATE POLICY "editorial_content_freelancer_read" ON editorial_content
  FOR SELECT USING (
    current_freelancer_id() IS NOT NULL
    AND client_name = ANY(
      (SELECT editorial_client_names FROM freelancers WHERE id = current_freelancer_id())
    )
  );
