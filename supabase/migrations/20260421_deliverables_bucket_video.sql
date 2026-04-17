-- Ensure deliverables bucket allows video files (mp4, mov, etc.)
-- allowed_mime_types = null means all types are allowed.
UPDATE storage.buckets
SET allowed_mime_types = null
WHERE id = 'deliverables';

-- Ensure admin delete policy exists on clients (idempotent)
DROP POLICY IF EXISTS "clients_admin_all" ON clients;
CREATE POLICY "clients_admin_all" ON clients
  FOR ALL USING (is_admin())
  WITH CHECK (is_admin());
