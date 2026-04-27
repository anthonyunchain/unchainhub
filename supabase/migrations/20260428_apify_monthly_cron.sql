-- Monthly cron: auto-scrape client social stats + competitor data via Apify on the 1st of each month.
-- Requires: pg_cron + pg_net extensions (already enabled).
-- Uses the same pattern as generateWorkflowTasks cron.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule previous version if it exists
DO $cron$
BEGIN
  PERFORM cron.unschedule('apify-monthly-social-stats')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'apify-monthly-social-stats');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$cron$;

SELECT cron.schedule(
  'apify-monthly-social-stats',
  '0 7 1 * *',   -- 07:00 UTC on the 1st of every month (1h after workflow tasks)
  $$
    SELECT net.http_post(
      url     := 'https://uhqfohbfzxukfhdqntck.supabase.co/functions/v1/apifyStartScrape',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body    := jsonb_build_object(
        'type',        'all',
        'auto',        true,
        'period',      to_char(date_trunc('month', now() - interval '1 month'), 'YYYY-MM')
      )
    )
  $$
);

-- Note: the cron scrapes the PREVIOUS month (e.g. on May 1st it scrapes April's data),
-- which gives all posts for the full month time to be published.
