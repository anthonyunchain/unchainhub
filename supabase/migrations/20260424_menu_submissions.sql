-- =============================================================================
-- STAFF ROLE + MENU SUBMISSIONS
-- =============================================================================
-- Lets restaurant/bakery staff log in to a minimal portal and submit the menu
-- (text + PDF/photo files). Staff belongs to one client via clients.staff_user_id.
-- Admin sees submissions in ClientDetail and transmits them to the freelancer.
-- =============================================================================

-- Link staff user to a client (1 staff per client for MVP)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS staff_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_staff_user_id ON clients(staff_user_id);

-- Helper: id of the client this staff user belongs to (or null)
CREATE OR REPLACE FUNCTION current_staff_client_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM clients
  WHERE staff_user_id = auth.uid()
  LIMIT 1;
$$;

-- =============================================================================
-- TABLE: menu_submissions
-- =============================================================================
CREATE TABLE IF NOT EXISTS menu_submissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  staff_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title       text NOT NULL,
  period      text,
  notes       text,
  files       jsonb NOT NULL DEFAULT '[]'::jsonb,
  status      text NOT NULL DEFAULT 'received'
              CHECK (status IN ('received', 'transmitted', 'published', 'archived')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_submissions_client_id ON menu_submissions(client_id);
CREATE INDEX IF NOT EXISTS idx_menu_submissions_created_at ON menu_submissions(created_at DESC);

-- Auto-update updated_at on every row update
CREATE OR REPLACE FUNCTION menu_submissions_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_menu_submissions_touch ON menu_submissions;
CREATE TRIGGER trg_menu_submissions_touch
  BEFORE UPDATE ON menu_submissions
  FOR EACH ROW EXECUTE FUNCTION menu_submissions_touch_updated_at();

-- RLS
ALTER TABLE menu_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menu_submissions_admin_all" ON menu_submissions
  FOR ALL USING (is_admin());

-- Staff: can read only submissions for their own client
CREATE POLICY "menu_submissions_staff_read" ON menu_submissions
  FOR SELECT USING (
    client_id = current_staff_client_id()
    AND current_staff_client_id() IS NOT NULL
  );

-- Staff: can insert submissions for their own client (and only tag themselves)
CREATE POLICY "menu_submissions_staff_insert" ON menu_submissions
  FOR INSERT WITH CHECK (
    client_id = current_staff_client_id()
    AND staff_id = auth.uid()
    AND current_staff_client_id() IS NOT NULL
  );

-- =============================================================================
-- STORAGE BUCKET: menu-submissions
-- Files are organized per client under {client_id}/{filename}
-- =============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-submissions', 'menu-submissions', false)
ON CONFLICT (id) DO NOTHING;

-- Admin: full access
DROP POLICY IF EXISTS "menu_submissions_bucket_admin_all" ON storage.objects;
CREATE POLICY "menu_submissions_bucket_admin_all" ON storage.objects
  FOR ALL USING (bucket_id = 'menu-submissions' AND is_admin());

-- Staff: read/insert only in their own client folder
DROP POLICY IF EXISTS "menu_submissions_bucket_staff_read" ON storage.objects;
CREATE POLICY "menu_submissions_bucket_staff_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'menu-submissions'
    AND current_staff_client_id() IS NOT NULL
    AND (storage.foldername(name))[1] = current_staff_client_id()::text
  );

DROP POLICY IF EXISTS "menu_submissions_bucket_staff_insert" ON storage.objects;
CREATE POLICY "menu_submissions_bucket_staff_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'menu-submissions'
    AND current_staff_client_id() IS NOT NULL
    AND (storage.foldername(name))[1] = current_staff_client_id()::text
  );

-- Staff can also read the client row to know their own restaurant name / language
-- (profiles_self_read already covers reading their own profile)
DROP POLICY IF EXISTS "clients_staff_self_read" ON clients;
CREATE POLICY "clients_staff_self_read" ON clients
  FOR SELECT USING (staff_user_id = auth.uid());
