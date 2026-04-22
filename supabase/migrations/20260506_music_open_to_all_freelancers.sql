-- =============================================================================
-- Open the music library (client_music_tracks + music-library storage) to ALL
-- freelancers, regardless of role or editorial_client_names scope.
-- Also lets every freelancer read clients.id/company_name so the UI can label
-- tracks per client.
-- =============================================================================

-- 1) client_music_tracks: any authenticated freelancer can SELECT
DROP POLICY IF EXISTS "client_music_tracks_video_editor_read" ON client_music_tracks;
DROP POLICY IF EXISTS "client_music_tracks_freelancer_read_all" ON client_music_tracks;
CREATE POLICY "client_music_tracks_freelancer_read_all" ON client_music_tracks
  FOR SELECT USING (current_freelancer_id() IS NOT NULL);

-- 2) storage bucket 'music-library': any freelancer can read any file
DROP POLICY IF EXISTS "music_library_video_editor_read" ON storage.objects;
DROP POLICY IF EXISTS "music_library_freelancer_read_all" ON storage.objects;
CREATE POLICY "music_library_freelancer_read_all" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'music-library'
    AND current_freelancer_id() IS NOT NULL
  );

-- 3) clients: any freelancer can read id/company_name rows that have music
-- tracks, so the music tab can group tracks under each client name.
-- We broaden the existing freelancer read policy to all freelancers for clients
-- that appear in client_music_tracks.
DROP POLICY IF EXISTS "clients_freelancer_music_read" ON clients;
CREATE POLICY "clients_freelancer_music_read" ON clients
  FOR SELECT USING (
    current_freelancer_id() IS NOT NULL
    AND EXISTS (SELECT 1 FROM client_music_tracks m WHERE m.client_id = clients.id)
  );
