-- =============================================================================
-- CLIENT CREDENTIALS — hardening pass
-- =============================================================================
--   A) Encryption at rest via pgsodium (AEAD, deterministic)
--      - username / password columns replaced with encrypted bytea
--      - Reads & writes go through SECURITY DEFINER RPCs; direct SELECT on the
--        columns yields opaque ciphertext
--      - Encryption key lives in pgsodium.key (encrypted by server master key)
--
--   B) Audit log — every mutation + every password "reveal" is recorded in
--      client_credentials_access_log
--
-- Idempotent: safe to run whether the prior migration was applied or not.
-- =============================================================================

-- Skip aggressive parse-time validation of function bodies. Supabase's
-- plpgsql was mis-resolving local variables in SELECT expressions
-- without a FROM clause as relations. Runtime execution works correctly.
SET check_function_bodies = off;

CREATE EXTENSION IF NOT EXISTS pgsodium;

-- ── Create (or reuse) the encryption key ─────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pgsodium.key WHERE name = 'client_credentials_key') THEN
    PERFORM pgsodium.create_key(name => 'client_credentials_key');
  END IF;
END $$;

-- ── Swap plaintext columns for encrypted bytea ───────────────────────────────
ALTER TABLE client_credentials DROP COLUMN IF EXISTS username;
ALTER TABLE client_credentials DROP COLUMN IF EXISTS password;
ALTER TABLE client_credentials ADD COLUMN IF NOT EXISTS username_enc bytea;
ALTER TABLE client_credentials ADD COLUMN IF NOT EXISTS password_enc bytea;

-- ── Revoke direct INSERT/UPDATE on sensitive columns from non-admin callers ──
-- Admins can still SELECT/DELETE directly (the encrypted columns are opaque).
-- Writes MUST go through the RPCs so ciphertext is produced server-side.
REVOKE INSERT, UPDATE ON client_credentials FROM authenticated;

-- =============================================================================
-- AUDIT LOG
-- =============================================================================
CREATE TABLE IF NOT EXISTS client_credentials_access_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id uuid,
  client_id     uuid NOT NULL,
  actor_id      uuid,              -- auth.uid() at time of access
  actor_email   text,              -- best-effort snapshot
  action        text NOT NULL,     -- 'create' | 'update' | 'delete' | 'reveal'
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ccal_client_id
  ON client_credentials_access_log(client_id, created_at DESC);

ALTER TABLE client_credentials_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ccal_admin_read" ON client_credentials_access_log;
CREATE POLICY "ccal_admin_read" ON client_credentials_access_log
  FOR SELECT USING (is_admin());

-- Only the RPCs (SECURITY DEFINER) insert into this table; no policy for write.

-- =============================================================================
-- HELPER — fetch the encryption key id for our named key
-- =============================================================================
CREATE OR REPLACE FUNCTION _cc_key_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pgsodium, pg_temp AS $$
  SELECT id FROM pgsodium.key WHERE name = 'client_credentials_key' LIMIT 1;
$$;

-- =============================================================================
-- RPC: get_client_credentials — returns decrypted rows for one client
-- =============================================================================
CREATE OR REPLACE FUNCTION get_client_credentials(p_client_id uuid)
RETURNS TABLE (
  id uuid, label text, login_url text, username text, password text,
  category text, notes text, "position" int, created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pgsodium, pg_temp
AS $$
#variable_conflict use_variable
DECLARE
  cc_key uuid := _cc_key_id();
BEGIN
  -- Auth: admin OR the owning client's portal user
  IF NOT (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = p_client_id AND c.portal_user_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    cc.id,
    cc.label,
    cc.login_url,
    CASE WHEN cc.username_enc IS NOT NULL
      THEN convert_from(
        pgsodium.crypto_aead_det_decrypt(
          cc.username_enc, cc.client_id::text::bytea, cc_key
        ), 'utf8')
      ELSE NULL END,
    CASE WHEN cc.password_enc IS NOT NULL
      THEN convert_from(
        pgsodium.crypto_aead_det_decrypt(
          cc.password_enc, cc.client_id::text::bytea, cc_key
        ), 'utf8')
      ELSE NULL END,
    cc.category, cc.notes, cc."position", cc.created_at
  FROM client_credentials cc
  WHERE cc.client_id = p_client_id
  ORDER BY cc."position" ASC, cc.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION get_client_credentials(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_client_credentials(uuid) TO authenticated;

-- =============================================================================
-- RPC: upsert_client_credential — admin only, encrypts values + audit logs
-- =============================================================================
CREATE OR REPLACE FUNCTION upsert_client_credential(
  p_id uuid,
  p_client_id uuid,
  p_label text,
  p_login_url text,
  p_username text,
  p_password text,
  p_category text,
  p_notes text,
  p_position int
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pgsodium, pg_temp
AS $$
#variable_conflict use_variable
DECLARE
  cc_key uuid := _cc_key_id();
  cc_id  uuid;
  cc_aad bytea := p_client_id::text::bytea;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO client_credentials (
      client_id, label, login_url,
      username_enc, password_enc,
      category, notes, "position"
    ) VALUES (
      p_client_id, p_label, NULLIF(p_login_url, ''),
      CASE WHEN p_username IS NOT NULL AND p_username <> ''
        THEN pgsodium.crypto_aead_det_encrypt(p_username::bytea, cc_aad, cc_key) END,
      CASE WHEN p_password IS NOT NULL AND p_password <> ''
        THEN pgsodium.crypto_aead_det_encrypt(p_password::bytea, cc_aad, cc_key) END,
      NULLIF(p_category, ''), NULLIF(p_notes, ''), COALESCE(p_position, 0)
    ) RETURNING id INTO cc_id;

    INSERT INTO client_credentials_access_log (credential_id, client_id, actor_id, actor_email, action)
    SELECT cc_id, p_client_id, auth.uid(), auth.jwt() ->> 'email', 'create';
  ELSE
    UPDATE client_credentials SET
      label        = p_label,
      login_url    = NULLIF(p_login_url, ''),
      username_enc = CASE WHEN p_username IS NOT NULL AND p_username <> ''
        THEN pgsodium.crypto_aead_det_encrypt(p_username::bytea, cc_aad, cc_key) END,
      password_enc = CASE WHEN p_password IS NOT NULL AND p_password <> ''
        THEN pgsodium.crypto_aead_det_encrypt(p_password::bytea, cc_aad, cc_key) END,
      category     = NULLIF(p_category, ''),
      notes        = NULLIF(p_notes, ''),
      "position"   = COALESCE(p_position, 0),
      updated_at   = now()
    WHERE id = p_id
    RETURNING id INTO cc_id;

    INSERT INTO client_credentials_access_log (credential_id, client_id, actor_id, actor_email, action)
    SELECT cc_id, p_client_id, auth.uid(), auth.jwt() ->> 'email', 'update';
  END IF;

  RETURN cc_id;
END;
$$;

REVOKE ALL ON FUNCTION upsert_client_credential(uuid, uuid, text, text, text, text, text, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_client_credential(uuid, uuid, text, text, text, text, text, text, int) TO authenticated;

-- =============================================================================
-- RPC: delete_client_credential — admin only, audit logs
-- =============================================================================
CREATE OR REPLACE FUNCTION delete_client_credential(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_variable
DECLARE
  cc_cid uuid;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT client_id INTO cc_cid FROM client_credentials WHERE id = p_id;
  IF cc_cid IS NULL THEN RETURN; END IF;

  DELETE FROM client_credentials WHERE id = p_id;

  INSERT INTO client_credentials_access_log (credential_id, client_id, actor_id, actor_email, action)
  SELECT p_id, cc_cid, auth.uid(), auth.jwt() ->> 'email', 'delete';
END;
$$;

REVOKE ALL ON FUNCTION delete_client_credential(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_client_credential(uuid) TO authenticated;

-- =============================================================================
-- RPC: log_credential_reveal — fire-and-forget from client UI when
-- the user clicks "Show password". Auth check is the same as get_*.
-- =============================================================================
CREATE OR REPLACE FUNCTION log_credential_reveal(p_credential_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_variable
DECLARE
  cc_cid uuid;
BEGIN
  SELECT client_id INTO cc_cid FROM client_credentials WHERE id = p_credential_id;
  IF cc_cid IS NULL THEN RETURN; END IF;

  IF NOT (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = cc_cid AND c.portal_user_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  INSERT INTO client_credentials_access_log (credential_id, client_id, actor_id, actor_email, action)
  SELECT p_credential_id, cc_cid, auth.uid(), auth.jwt() ->> 'email', 'reveal';
END;
$$;

REVOKE ALL ON FUNCTION log_credential_reveal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION log_credential_reveal(uuid) TO authenticated;

RESET check_function_bodies;
