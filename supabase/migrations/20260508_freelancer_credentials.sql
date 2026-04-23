-- =============================================================================
-- FREELANCER CREDENTIALS — per-freelancer vault for tool logins
-- =============================================================================
-- Admin curates login credentials (Canva, Frame.io, client CMS, Dropbox, etc.)
-- per freelancer. The freelancer sees them in their portal with
-- copy-to-clipboard for username/password and a link to the login page.
--
-- Mirrors the hardening posture of client_credentials:
--   • Plaintext storage (same as the rest of the app — relies on Supabase's
--     disk-level encryption + TLS in transit, not column-level encryption).
--   • Writes go through SECURITY DEFINER RPCs (admin-only).
--   • Reads via RPC enforce admin OR owning-freelancer auth check.
--   • Audit log records create / update / delete / reveal.
-- =============================================================================

SET check_function_bodies = off;

CREATE TABLE IF NOT EXISTS freelancer_credentials (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  freelancer_id  uuid NOT NULL REFERENCES freelancers(id) ON DELETE CASCADE,
  label          text NOT NULL,
  login_url      text,
  username       text,
  password       text,
  category       text,
  notes          text,
  position       int  NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_freelancer_credentials_freelancer_id
  ON freelancer_credentials(freelancer_id, position, created_at DESC);

CREATE OR REPLACE FUNCTION freelancer_credentials_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_freelancer_credentials_touch ON freelancer_credentials;
CREATE TRIGGER trg_freelancer_credentials_touch
  BEFORE UPDATE ON freelancer_credentials
  FOR EACH ROW EXECUTE FUNCTION freelancer_credentials_touch_updated_at();

-- =============================================================================
-- RLS — direct access blocked for non-admin; all CRUD routed through RPCs
-- =============================================================================
ALTER TABLE freelancer_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "freelancer_credentials_admin_all" ON freelancer_credentials;
CREATE POLICY "freelancer_credentials_admin_all" ON freelancer_credentials
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "freelancer_credentials_own_read" ON freelancer_credentials;
CREATE POLICY "freelancer_credentials_own_read" ON freelancer_credentials
  FOR SELECT USING (freelancer_id = current_freelancer_id());

-- Freelancers cannot INSERT/UPDATE/DELETE even their own rows
REVOKE INSERT, UPDATE, DELETE ON freelancer_credentials FROM authenticated;

-- =============================================================================
-- AUDIT LOG
-- =============================================================================
CREATE TABLE IF NOT EXISTS freelancer_credentials_access_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id  uuid,
  freelancer_id  uuid NOT NULL,
  actor_id       uuid,
  actor_email    text,
  action         text NOT NULL, -- 'create' | 'update' | 'delete' | 'reveal'
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fcal_freelancer_id
  ON freelancer_credentials_access_log(freelancer_id, created_at DESC);

ALTER TABLE freelancer_credentials_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fcal_admin_read" ON freelancer_credentials_access_log;
CREATE POLICY "fcal_admin_read" ON freelancer_credentials_access_log
  FOR SELECT USING (is_admin());

-- Only RPCs (SECURITY DEFINER) insert into this table; no write policy.

-- =============================================================================
-- RPC: get_freelancer_credentials
-- =============================================================================
CREATE OR REPLACE FUNCTION get_freelancer_credentials(p_freelancer_id uuid)
RETURNS TABLE (
  id uuid, label text, login_url text, username text, password text,
  category text, notes text, "position" int, created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT (is_admin() OR p_freelancer_id = current_freelancer_id()) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT fc.id, fc.label, fc.login_url, fc.username, fc.password,
         fc.category, fc.notes, fc."position", fc.created_at
  FROM freelancer_credentials fc
  WHERE fc.freelancer_id = p_freelancer_id
  ORDER BY fc."position" ASC, fc.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION get_freelancer_credentials(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_freelancer_credentials(uuid) TO authenticated;

-- =============================================================================
-- RPC: upsert_freelancer_credential — admin only
-- =============================================================================
CREATE OR REPLACE FUNCTION upsert_freelancer_credential(
  p_id uuid,
  p_freelancer_id uuid,
  p_label text,
  p_login_url text,
  p_username text,
  p_password text,
  p_category text,
  p_notes text,
  p_position int
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO freelancer_credentials (
      freelancer_id, label, login_url,
      username, password,
      category, notes, "position"
    ) VALUES (
      p_freelancer_id, p_label, NULLIF(p_login_url, ''),
      NULLIF(p_username, ''), NULLIF(p_password, ''),
      NULLIF(p_category, ''), NULLIF(p_notes, ''), COALESCE(p_position, 0)
    ) RETURNING id INTO new_id;

    EXECUTE
      'INSERT INTO freelancer_credentials_access_log (credential_id, freelancer_id, actor_id, actor_email, action)
       VALUES ($1, $2, $3, $4, $5)'
      USING new_id, p_freelancer_id, auth.uid(), auth.jwt() ->> 'email', 'create';
  ELSE
    UPDATE freelancer_credentials SET
      label      = p_label,
      login_url  = NULLIF(p_login_url, ''),
      username   = NULLIF(p_username, ''),
      password   = NULLIF(p_password, ''),
      category   = NULLIF(p_category, ''),
      notes      = NULLIF(p_notes, ''),
      "position" = COALESCE(p_position, 0),
      updated_at = now()
    WHERE id = p_id
    RETURNING id INTO new_id;

    EXECUTE
      'INSERT INTO freelancer_credentials_access_log (credential_id, freelancer_id, actor_id, actor_email, action)
       VALUES ($1, $2, $3, $4, $5)'
      USING new_id, p_freelancer_id, auth.uid(), auth.jwt() ->> 'email', 'update';
  END IF;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION upsert_freelancer_credential(uuid, uuid, text, text, text, text, text, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_freelancer_credential(uuid, uuid, text, text, text, text, text, text, int) TO authenticated;

-- =============================================================================
-- RPC: delete_freelancer_credential — admin only
-- =============================================================================
CREATE OR REPLACE FUNCTION delete_freelancer_credential(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  owner_id uuid;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT freelancer_id INTO owner_id FROM freelancer_credentials WHERE id = p_id;
  IF owner_id IS NULL THEN RETURN; END IF;

  DELETE FROM freelancer_credentials WHERE id = p_id;

  EXECUTE
    'INSERT INTO freelancer_credentials_access_log (credential_id, freelancer_id, actor_id, actor_email, action)
     VALUES ($1, $2, $3, $4, $5)'
    USING p_id, owner_id, auth.uid(), auth.jwt() ->> 'email', 'delete';
END;
$$;

REVOKE ALL ON FUNCTION delete_freelancer_credential(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_freelancer_credential(uuid) TO authenticated;

-- =============================================================================
-- RPC: log_freelancer_credential_reveal — fired from the portal UI when the
-- freelancer or admin clicks "Show password". Auth check mirrors get_*.
-- =============================================================================
CREATE OR REPLACE FUNCTION log_freelancer_credential_reveal(p_credential_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  owner_id uuid;
BEGIN
  SELECT freelancer_id INTO owner_id FROM freelancer_credentials WHERE id = p_credential_id;
  IF owner_id IS NULL THEN RETURN; END IF;

  IF NOT (is_admin() OR owner_id = current_freelancer_id()) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  EXECUTE
    'INSERT INTO freelancer_credentials_access_log (credential_id, freelancer_id, actor_id, actor_email, action)
     VALUES ($1, $2, $3, $4, $5)'
    USING p_credential_id, owner_id, auth.uid(), auth.jwt() ->> 'email', 'reveal';
END;
$$;

REVOKE ALL ON FUNCTION log_freelancer_credential_reveal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION log_freelancer_credential_reveal(uuid) TO authenticated;

RESET check_function_bodies;
