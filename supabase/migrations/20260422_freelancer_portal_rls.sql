-- Freelancer portal: extend self-read RLS to match by user_id (per-freelancer auth account),
-- keeping email match as a fallback. Mirrors the clients portal_user_id pattern.

DROP POLICY IF EXISTS "freelancers_self_read" ON freelancers;

CREATE POLICY "freelancers_self_read" ON freelancers
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR email = auth.email()
  );
