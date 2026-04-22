-- Monthly cron: generate workflow tasks for all active clients on the 1st of each month.
-- Requires: pg_cron + pg_net extensions (both enabled by default on Supabase).
-- The service-role key is stored in Supabase Vault as 'service_role_key'.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule previous version if it exists
DO $cron$
BEGIN
  PERFORM cron.unschedule('generate-workflow-tasks-monthly')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate-workflow-tasks-monthly');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$cron$;

SELECT cron.schedule(
  'generate-workflow-tasks-monthly',
  '0 6 1 * *',   -- 06:00 UTC on the 1st of every month
  $$
    SELECT net.http_post(
      url     := 'https://uhqfohbfzxukfhdqntck.supabase.co/functions/v1/generateWorkflowTasks',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body    := jsonb_build_object(
        'month', to_char(now(), 'YYYY-MM')
      )
    )
  $$
);

-- To activate: run this once in SQL editor to store your service role key:
--   ALTER DATABASE postgres SET app.service_role_key = '<your-service-role-key>';
