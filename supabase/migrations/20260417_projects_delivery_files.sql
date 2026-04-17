-- Add delivery_files and revision_requests columns to projects.
-- delivery_files: array of { path, name, size, uploaded_at }
-- revision_requests: array of { id, message, files: [...], link, by_admin_name, created_at }
ALTER TABLE projects ADD COLUMN IF NOT EXISTS delivery_files jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS revision_requests jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Private bucket for deliverables (50 MB max per file = Supabase Free limit).
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('deliverables', 'deliverables', false, 52428800)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800;

-- Storage RLS: any authenticated user (admin + freelancers) can upload,
-- read, and delete objects in this bucket. Fine for this app since only
-- trusted users are authenticated.
DROP POLICY IF EXISTS "deliverables_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "deliverables_auth_read"   ON storage.objects;
DROP POLICY IF EXISTS "deliverables_auth_delete" ON storage.objects;

CREATE POLICY "deliverables_auth_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'deliverables');

CREATE POLICY "deliverables_auth_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'deliverables');

CREATE POLICY "deliverables_auth_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'deliverables');

NOTIFY pgrst, 'reload schema';
