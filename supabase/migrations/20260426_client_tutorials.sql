-- =============================================================================
-- CLIENT TUTORIALS — unlisted YouTube videos curated by admin, shown in the
-- client portal's "Tutorials" tab.
-- =============================================================================
-- MVP: global tutorials, visible to all authenticated users (admins, clients,
-- staff, freelancers). Can be extended later with client_ids[] scoping.
-- =============================================================================

CREATE TABLE IF NOT EXISTS tutorials (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text,
  youtube_url text NOT NULL,
  category    text,
  position    int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutorials_position ON tutorials(position, created_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION tutorials_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tutorials_touch ON tutorials;
CREATE TRIGGER trg_tutorials_touch
  BEFORE UPDATE ON tutorials
  FOR EACH ROW EXECUTE FUNCTION tutorials_touch_updated_at();

-- RLS
ALTER TABLE tutorials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tutorials_admin_all" ON tutorials
  FOR ALL USING (is_admin());

-- Any authenticated user can read the list (clients, staff, freelancers).
CREATE POLICY "tutorials_authenticated_read" ON tutorials
  FOR SELECT USING (auth.uid() IS NOT NULL);
