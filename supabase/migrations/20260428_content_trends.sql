-- Content trends scraped by Apify (hashtags, topics) for editorial suggestions
CREATE TABLE IF NOT EXISTS content_trends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  client_name text NOT NULL,
  hashtag text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('Instagram', 'TikTok', 'LinkedIn', 'Facebook', 'Other')),
  trend_score int DEFAULT 0,
  sample_posts jsonb DEFAULT '[]'::jsonb,  -- [{ url, likes, caption, thumbnail_url }]
  period text NOT NULL,                     -- YYYY-MM
  scraped_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- RLS: admins only
ALTER TABLE content_trends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_trends_admin_all" ON content_trends
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS content_trends_client_id_idx ON content_trends (client_id);
CREATE INDEX IF NOT EXISTS content_trends_period_idx ON content_trends (period);
CREATE INDEX IF NOT EXISTS content_trends_platform_idx ON content_trends (platform);
