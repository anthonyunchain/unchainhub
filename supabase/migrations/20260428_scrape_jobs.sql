-- Tracks async Apify scraping jobs (started by admin or cron)
CREATE TABLE IF NOT EXISTS scrape_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('social_stats', 'competitor', 'trends', 'all')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done', 'error')),
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz,
  apify_run_ids jsonb DEFAULT '[]'::jsonb,   -- [{ runId, clientId, platform, type }]
  clients_count int DEFAULT 0,
  results_count int DEFAULT 0,
  error_message text,
  triggered_by text DEFAULT 'admin'          -- 'admin' | 'cron'
);

-- RLS: admins only
ALTER TABLE scrape_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scrape_jobs_admin_all" ON scrape_jobs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS scrape_jobs_status_idx ON scrape_jobs (status);
CREATE INDEX IF NOT EXISTS scrape_jobs_started_at_idx ON scrape_jobs (started_at DESC);
