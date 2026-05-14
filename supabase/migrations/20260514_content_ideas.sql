-- Content ideas bank: reusable templates (general) and one-shot ideas (specific) per client.

CREATE TABLE IF NOT EXISTS public.content_ideas (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name          TEXT NOT NULL,
  category             TEXT NOT NULL CHECK (category IN ('general', 'specific')),
  title                TEXT NOT NULL,
  caption              TEXT,
  post_type            TEXT NOT NULL DEFAULT 'Reel' CHECK (post_type IN ('Reel', 'Story', 'Carousel')),
  platform             TEXT NOT NULL DEFAULT 'Instagram',
  reference_url        TEXT,
  reference_file_url   TEXT,
  reference_file_name  TEXT,
  attached_file_url    TEXT,
  attached_file_name   TEXT,
  used_at              TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.content_ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_ideas_admin_all" ON public.content_ideas
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Storage bucket for idea reference images and attached files
INSERT INTO storage.buckets (id, name, public)
VALUES ('content-ideas', 'content-ideas', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "content_ideas_bucket_upload" ON storage.objects;
CREATE POLICY "content_ideas_bucket_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'content-ideas');

DROP POLICY IF EXISTS "content_ideas_bucket_read" ON storage.objects;
CREATE POLICY "content_ideas_bucket_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'content-ideas');

DROP POLICY IF EXISTS "content_ideas_bucket_delete" ON storage.objects;
CREATE POLICY "content_ideas_bucket_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'content-ideas');
