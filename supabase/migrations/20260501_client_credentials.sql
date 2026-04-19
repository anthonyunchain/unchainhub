-- =============================================================================
-- CLIENT CREDENTIALS — per-client vault for third-party tool logins
-- =============================================================================
-- Admin curates login credentials (Webflow, Meta Business, Google Analytics,
-- Dropbox, etc.) per client. The client sees them in their portal with
-- copy-to-clipboard for username/password and a direct link to the login page.
-- =============================================================================

CREATE TABLE IF NOT EXISTS client_credentials (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  label       text NOT NULL,
  login_url   text,
  username    text,
  password    text,
  category    text,
  notes       text,
  position    int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_credentials_client_id
  ON client_credentials(client_id, position, created_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION client_credentials_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_credentials_touch ON client_credentials;
CREATE TRIGGER trg_client_credentials_touch
  BEFORE UPDATE ON client_credentials
  FOR EACH ROW EXECUTE FUNCTION client_credentials_touch_updated_at();

-- =============================================================================
-- RLS
-- =============================================================================
ALTER TABLE client_credentials ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY "client_credentials_admin_all" ON client_credentials
  FOR ALL USING (is_admin());

-- The owning client can read only their own credentials
CREATE POLICY "client_credentials_own_read" ON client_credentials
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = client_credentials.client_id
        AND c.portal_user_id = auth.uid()
    )
  );
