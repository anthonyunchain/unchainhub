-- Competitor social media stats scraped by Apify
CREATE TABLE IF NOT EXISTS competitor_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  client_name text NOT NULL,
  competitor_handle text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('Instagram', 'TikTok', 'LinkedIn', 'Facebook', 'Other')),
  period text NOT NULL,           -- YYYY-MM
  followers int DEFAULT 0,
  avg_likes float DEFAULT 0,
  avg_views float DEFAULT 0,
  avg_comments float DEFAULT 0,
  posts_count int DEFAULT 0,
  scraped_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE (client_id, competitor_handle, platform, period)
);

-- RLS: admins only
ALTER TABLE competitor_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "competitor_stats_admin_all" ON competitor_stats
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS competitor_stats_client_id_idx ON competitor_stats (client_id);
CREATE INDEX IF NOT EXISTS competitor_stats_period_idx ON competitor_stats (period);
