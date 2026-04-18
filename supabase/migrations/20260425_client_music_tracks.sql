-- =============================================================================
-- CLIENT MUSIC TRACKS — per-client music library for video editors
-- =============================================================================
-- Admin curates music tracks per client (URL or MP3 upload).
-- Video-editor freelancers can browse the music of clients they're assigned to
-- (via freelancers.editorial_client_names).
-- =============================================================================

CREATE TABLE IF NOT EXISTS client_music_tracks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title         text NOT NULL,
  artist        text,
  mood          text,
  bpm           int,
  duration_sec  int,
  url           text,            -- external link (Spotify, YouTube, Dropbox, etc.)
  file_path     text,            -- object key in storage bucket 'music-library'
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT music_has_source CHECK (url IS NOT NULL OR file_path IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_client_music_tracks_client_id ON client_music_tracks(client_id);
CREATE INDEX IF NOT EXISTS idx_client_music_tracks_created_at ON client_music_tracks(created_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION client_music_tracks_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_music_tracks_touch ON client_music_tracks;
CREATE TRIGGER trg_client_music_tracks_touch
  BEFORE UPDATE ON client_music_tracks
  FOR EACH ROW EXECUTE FUNCTION client_music_tracks_touch_updated_at();

-- =============================================================================
-- HELPER: can the current freelancer access a given client's music?
-- Rules:
--   • Must be a freelancer
--   • Must be tagged as a video editor (role or tags contain "video editor" / "monteur")
--   • The client's company_name must appear in their editorial_client_names
-- =============================================================================
CREATE OR REPLACE FUNCTION current_freelancer_can_access_client_music(cid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM freelancers f
    JOIN clients c ON c.id = cid
    WHERE f.id = current_freelancer_id()
      AND (
        COALESCE(f.role, '') ILIKE '%video editor%'
        OR COALESCE(f.role, '') ILIKE '%monteur%'
        OR 'video editor' = ANY (
          SELECT LOWER(x) FROM unnest(COALESCE(f.tags, ARRAY[]::text[])) AS x
        )
      )
      AND c.company_name = ANY (COALESCE(f.editorial_client_names, ARRAY[]::text[]))
  );
$$;

-- =============================================================================
-- RLS
-- =============================================================================
ALTER TABLE client_music_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_music_tracks_admin_all" ON client_music_tracks
  FOR ALL USING (is_admin());

CREATE POLICY "client_music_tracks_video_editor_read" ON client_music_tracks
  FOR SELECT USING (current_freelancer_can_access_client_music(client_id));

-- Allow freelancers to read the client row (only the ones in their editorial
-- scope) — needed so the UI can display "{client_name}" alongside each track.
DROP POLICY IF EXISTS "clients_freelancer_editorial_read" ON clients;
CREATE POLICY "clients_freelancer_editorial_read" ON clients
  FOR SELECT USING (
    current_freelancer_id() IS NOT NULL
    AND company_name = ANY (
      COALESCE(
        (SELECT editorial_client_names FROM freelancers WHERE id = current_freelancer_id()),
        ARRAY[]::text[]
      )
    )
  );

-- =============================================================================
-- STORAGE BUCKET: music-library
-- Files organized per client under {client_id}/{filename}
-- =============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('music-library', 'music-library', false)
ON CONFLICT (id) DO NOTHING;

-- Admin: full access
DROP POLICY IF EXISTS "music_library_admin_all" ON storage.objects;
CREATE POLICY "music_library_admin_all" ON storage.objects
  FOR ALL USING (bucket_id = 'music-library' AND is_admin());

-- Video editors: read files in folders of clients they're authorized for
DROP POLICY IF EXISTS "music_library_video_editor_read" ON storage.objects;
CREATE POLICY "music_library_video_editor_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'music-library'
    AND current_freelancer_can_access_client_music(
      NULLIF((storage.foldername(name))[1], '')::uuid
    )
  );
