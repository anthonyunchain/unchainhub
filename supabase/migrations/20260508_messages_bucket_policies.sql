-- Create storage RLS policies for the `messages` bucket so authenticated users
-- can upload + read chat attachments.
-- The original messaging migration used `CREATE POLICY IF NOT EXISTS`, which
-- Postgres does not support on policies, so those two statements failed and
-- the bucket ended up with no policies (uploads were silently blocked by RLS).

DROP POLICY IF EXISTS "messages_bucket_upload" ON storage.objects;
CREATE POLICY "messages_bucket_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'messages');

DROP POLICY IF EXISTS "messages_bucket_read" ON storage.objects;
CREATE POLICY "messages_bucket_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'messages');
