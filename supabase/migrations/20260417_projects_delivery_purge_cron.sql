-- Daily cron that removes uploaded delivery/revision files for projects
-- that have been "Completed" for more than 60 days. Keeps the project
-- rows and the URL/history (just clears file arrays and deletes the
-- actual storage objects).

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.purge_old_project_files()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec         record;
  file_obj    jsonb;
  rev_req     jsonb;
  nested_file jsonb;
BEGIN
  FOR rec IN
    SELECT id, delivery_files, revision_requests
    FROM projects
    WHERE status = 'Completed'
      AND updated_at < now() - interval '60 days'
      AND (jsonb_array_length(delivery_files) > 0
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(revision_requests) r
          WHERE jsonb_array_length(COALESCE(r->'files', '[]'::jsonb)) > 0
        ))
  LOOP
    -- Delete each delivery file object
    FOR file_obj IN SELECT * FROM jsonb_array_elements(rec.delivery_files)
    LOOP
      DELETE FROM storage.objects
      WHERE bucket_id = 'deliverables'
        AND name = (file_obj->>'path');
    END LOOP;

    -- Delete each revision request's file objects
    FOR rev_req IN SELECT * FROM jsonb_array_elements(rec.revision_requests)
    LOOP
      FOR nested_file IN SELECT * FROM jsonb_array_elements(COALESCE(rev_req->'files', '[]'::jsonb))
      LOOP
        DELETE FROM storage.objects
        WHERE bucket_id = 'deliverables'
          AND name = (nested_file->>'path');
      END LOOP;
    END LOOP;

    -- Clear the file references on the project row (keep message/link/history metadata)
    UPDATE projects
    SET delivery_files = '[]'::jsonb,
        revision_requests = COALESCE(
          (SELECT jsonb_agg(jsonb_set(r, '{files}', '[]'::jsonb))
           FROM jsonb_array_elements(revision_requests) r),
          '[]'::jsonb
        )
    WHERE id = rec.id;
  END LOOP;
END;
$$;

-- Schedule daily at 03:00 UTC (unschedule first if it already exists)
DO $cron$
BEGIN
  PERFORM cron.unschedule('purge-old-project-files')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-old-project-files');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$cron$;

SELECT cron.schedule(
  'purge-old-project-files',
  '0 3 * * *',
  $$SELECT public.purge_old_project_files();$$
);
