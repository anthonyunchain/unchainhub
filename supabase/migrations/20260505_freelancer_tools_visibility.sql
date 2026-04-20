-- =============================================================================
-- FREELANCER TOOLS — per-freelancer visibility
-- =============================================================================
-- Adds an optional visibility whitelist on freelancer_tools.
--   • visible_to_freelancer_ids IS NULL or empty → visible to all freelancers
--     (preserves current behavior for existing rows)
--   • visible_to_freelancer_ids = {uuid,...}     → only these freelancers see it
--
-- RLS on freelancer_tools is updated so freelancers only SELECT rows they're
-- allowed to see; admins remain unrestricted.
-- =============================================================================

ALTER TABLE freelancer_tools
  ADD COLUMN IF NOT EXISTS visible_to_freelancer_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

CREATE INDEX IF NOT EXISTS freelancer_tools_visible_to_gin
  ON freelancer_tools USING GIN (visible_to_freelancer_ids);

-- Replace the read policy: either no whitelist (empty array) or the current
-- freelancer is in the whitelist.
DROP POLICY IF EXISTS "freelancer_tools_freelancer_read" ON freelancer_tools;

CREATE POLICY "freelancer_tools_freelancer_read" ON freelancer_tools
  FOR SELECT USING (
    current_freelancer_id() IS NOT NULL
    AND (
      COALESCE(array_length(visible_to_freelancer_ids, 1), 0) = 0
      OR current_freelancer_id() = ANY (visible_to_freelancer_ids)
    )
  );
