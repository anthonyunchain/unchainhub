-- =============================================================================
-- SHOOTING ORGANIZATION SYSTEM
-- =============================================================================

-- Main shootings table
CREATE TABLE IF NOT EXISTS shootings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  client_name     text,
  date            date,
  time            text,
  location        text,
  status          text NOT NULL DEFAULT 'Planned',
  description     text,
  gear            text,
  notes           text,
  images          jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Freelancer assignments per shooting
CREATE TABLE IF NOT EXISTS shooting_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shooting_id     uuid NOT NULL REFERENCES shootings(id) ON DELETE CASCADE,
  freelancer_id   uuid NOT NULL,
  freelancer_name text NOT NULL DEFAULT '',
  role            text,
  status          text NOT NULL DEFAULT 'Pending',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_shooting_assignments_shooting ON shooting_assignments(shooting_id);
CREATE INDEX idx_shooting_assignments_freelancer ON shooting_assignments(freelancer_id);

-- Link shootings to editorial content
CREATE TABLE IF NOT EXISTS shooting_content (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shooting_id     uuid NOT NULL REFERENCES shootings(id) ON DELETE CASCADE,
  content_id      uuid NOT NULL REFERENCES editorial_content(id) ON DELETE CASCADE,
  UNIQUE(shooting_id, content_id)
);

-- =============================================================================
-- RLS
-- =============================================================================

-- shootings
ALTER TABLE shootings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shootings_admin_all" ON shootings
  FOR ALL USING (is_admin());

CREATE POLICY "shootings_freelancer_read" ON shootings
  FOR SELECT USING (
    id IN (SELECT shooting_id FROM shooting_assignments WHERE freelancer_id = current_freelancer_id())
  );

CREATE POLICY "shootings_client_read" ON shootings
  FOR SELECT USING (
    client_name IN (
      SELECT company_name FROM clients
      WHERE portal_user_id = auth.uid()
         OR contact_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- shooting_assignments
ALTER TABLE shooting_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shooting_assignments_admin_all" ON shooting_assignments
  FOR ALL USING (is_admin());

CREATE POLICY "shooting_assignments_freelancer_read" ON shooting_assignments
  FOR SELECT USING (freelancer_id = current_freelancer_id());

CREATE POLICY "shooting_assignments_freelancer_update" ON shooting_assignments
  FOR UPDATE USING (freelancer_id = current_freelancer_id())
  WITH CHECK (freelancer_id = current_freelancer_id());

-- shooting_content
ALTER TABLE shooting_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shooting_content_admin_all" ON shooting_content
  FOR ALL USING (is_admin());

CREATE POLICY "shooting_content_freelancer_read" ON shooting_content
  FOR SELECT USING (
    shooting_id IN (SELECT shooting_id FROM shooting_assignments WHERE freelancer_id = current_freelancer_id())
  );

CREATE POLICY "shooting_content_client_read" ON shooting_content
  FOR SELECT USING (
    shooting_id IN (
      SELECT id FROM shootings WHERE client_name IN (
        SELECT company_name FROM clients
        WHERE portal_user_id = auth.uid()
           OR contact_email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
    )
  );
