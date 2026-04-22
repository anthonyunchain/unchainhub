-- Per-freelancer timezone (IANA id, e.g. "Asia/Karachi"). When set, the
-- freelancer portal renders the clock in their local tz and also shows the
-- Helsinki (studio) time alongside.
ALTER TABLE freelancers ADD COLUMN IF NOT EXISTS timezone text;
