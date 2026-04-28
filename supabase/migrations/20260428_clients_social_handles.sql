-- Add social media handles, competitor tracking, and trend hashtags to clients table
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS instagram_handle text,
  ADD COLUMN IF NOT EXISTS tiktok_handle text,
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS competitor_handles jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS trend_hashtags jsonb DEFAULT '[]'::jsonb;

-- competitor_handles format: [{ "platform": "instagram", "handle": "@competitor" }, ...]
-- trend_hashtags format: ["reels", "contentmarketing", "socialmedia", ...]

COMMENT ON COLUMN clients.instagram_handle IS 'Instagram account handle (e.g. @agence)';
COMMENT ON COLUMN clients.tiktok_handle IS 'TikTok account handle (e.g. @agence)';
COMMENT ON COLUMN clients.linkedin_url IS 'LinkedIn company page URL';
COMMENT ON COLUMN clients.competitor_handles IS 'Array of competitor social handles to monitor: [{platform, handle}]';
COMMENT ON COLUMN clients.trend_hashtags IS 'Hashtags to monitor for content trend research (without #)';
