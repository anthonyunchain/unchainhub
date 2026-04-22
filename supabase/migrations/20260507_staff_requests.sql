-- =============================================================================
-- STAFF REQUESTS — Manager + Pastry/Baker chef forms
-- =============================================================================
-- Adds two more staff submission types alongside menu_submissions:
--   • manager_requests       — manager asks for new labels, assets, infos
--                              (deadline + importance level)
--   • pastry_chef_requests   — pastry/baker chef announces new products or
--                              asks for photo shoots (deadline optional)
-- Files reuse the existing `menu-submissions` bucket with the same
-- per-client folder policy.
-- =============================================================================

-- ─── MANAGER REQUESTS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS manager_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  staff_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title       text NOT NULL,
  description text,
  deadline    date,
  importance  text NOT NULL DEFAULT 'medium'
              CHECK (importance IN ('low', 'medium', 'high', 'urgent')),
  files       jsonb NOT NULL DEFAULT '[]'::jsonb,
  status      text NOT NULL DEFAULT 'received'
              CHECK (status IN ('received', 'in_progress', 'completed', 'archived')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manager_requests_client_id  ON manager_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_manager_requests_created_at ON manager_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_manager_requests_deadline   ON manager_requests(deadline);

CREATE OR REPLACE FUNCTION manager_requests_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_manager_requests_touch ON manager_requests;
CREATE TRIGGER trg_manager_requests_touch
  BEFORE UPDATE ON manager_requests
  FOR EACH ROW EXECUTE FUNCTION manager_requests_touch_updated_at();

ALTER TABLE manager_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manager_requests_admin_all" ON manager_requests;
CREATE POLICY "manager_requests_admin_all" ON manager_requests
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "manager_requests_staff_read" ON manager_requests;
CREATE POLICY "manager_requests_staff_read" ON manager_requests
  FOR SELECT USING (
    client_id = current_staff_client_id()
    AND current_staff_client_id() IS NOT NULL
  );

DROP POLICY IF EXISTS "manager_requests_staff_insert" ON manager_requests;
CREATE POLICY "manager_requests_staff_insert" ON manager_requests
  FOR INSERT WITH CHECK (
    client_id = current_staff_client_id()
    AND staff_id = auth.uid()
    AND current_staff_client_id() IS NOT NULL
  );

-- ─── PASTRY CHEF REQUESTS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pastry_chef_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  staff_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title       text NOT NULL,
  description text,
  deadline    date,
  files       jsonb NOT NULL DEFAULT '[]'::jsonb,
  status      text NOT NULL DEFAULT 'received'
              CHECK (status IN ('received', 'in_progress', 'completed', 'archived')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pastry_chef_requests_client_id  ON pastry_chef_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_pastry_chef_requests_created_at ON pastry_chef_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pastry_chef_requests_deadline   ON pastry_chef_requests(deadline);

CREATE OR REPLACE FUNCTION pastry_chef_requests_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pastry_chef_requests_touch ON pastry_chef_requests;
CREATE TRIGGER trg_pastry_chef_requests_touch
  BEFORE UPDATE ON pastry_chef_requests
  FOR EACH ROW EXECUTE FUNCTION pastry_chef_requests_touch_updated_at();

ALTER TABLE pastry_chef_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pastry_chef_requests_admin_all" ON pastry_chef_requests;
CREATE POLICY "pastry_chef_requests_admin_all" ON pastry_chef_requests
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "pastry_chef_requests_staff_read" ON pastry_chef_requests;
CREATE POLICY "pastry_chef_requests_staff_read" ON pastry_chef_requests
  FOR SELECT USING (
    client_id = current_staff_client_id()
    AND current_staff_client_id() IS NOT NULL
  );

DROP POLICY IF EXISTS "pastry_chef_requests_staff_insert" ON pastry_chef_requests;
CREATE POLICY "pastry_chef_requests_staff_insert" ON pastry_chef_requests
  FOR INSERT WITH CHECK (
    client_id = current_staff_client_id()
    AND staff_id = auth.uid()
    AND current_staff_client_id() IS NOT NULL
  );
