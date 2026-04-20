-- =============================================================================
-- CLIENT CREDENTIALS — rollback pgsodium column encryption
-- =============================================================================
-- Supabase restricts pgsodium access even for SECURITY DEFINER functions
-- owned by postgres (pgsodium is deprecated there in favor of Vault).
--
-- We revert to plaintext columns, BUT keep all other hardening:
--   • RPCs enforce admin-only writes + owner-only reads (same as before)
--   • client_credentials_access_log records create / update / delete / reveal
--   • RLS policies unchanged (only admin + owner client can SELECT)
--   • 2FA (TOTP) on client accounts unchanged
--   • All communication is TLS
--
-- Security posture is now equivalent to how other sensitive data in the
-- project is stored (emails, contracts, invoices). Encryption at rest relies
-- on Supabase's disk-level encryption, not column-level.
-- =============================================================================

SET check_function_bodies = off;

-- ── Clean up any test function left behind ──────────────────────────────────
DROP FUNCTION IF EXISTS _test_crypto_roundtrip();

-- ── Swap encrypted bytea columns for plaintext text columns ─────────────────
ALTER TABLE client_credentials ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE client_credentials ADD COLUMN IF NOT EXISTS password text;
ALTER TABLE client_credentials DROP COLUMN IF EXISTS username_enc;
ALTER TABLE client_credentials DROP COLUMN IF EXISTS password_enc;

-- =============================================================================
-- RPC: get_client_credentials (plaintext)
-- =============================================================================
CREATE OR REPLACE FUNCTION get_client_credentials(p_client_id uuid)
RETURNS TABLE (
  id uuid, label text, login_url text, username text, password text,
  category text, notes text, "position" int, created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
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
  SELECT cc.id, cc.label, cc.login_url, cc.username, cc.password,
         cc.category, cc.notes, cc."position", cc.created_at
  FROM client_credentials cc
  WHERE cc.client_id = p_client_id
  ORDER BY cc."position" ASC, cc.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION get_client_credentials(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_client_credentials(uuid) TO authenticated;

-- =============================================================================
-- RPC: upsert_client_credential (plaintext) — admin only, audit logs
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
SET search_path = public, pg_temp
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO client_credentials (
      client_id, label, login_url,
      username, password,
      category, notes, "position"
    ) VALUES (
      p_client_id, p_label, NULLIF(p_login_url, ''),
      NULLIF(p_username, ''), NULLIF(p_password, ''),
      NULLIF(p_category, ''), NULLIF(p_notes, ''), COALESCE(p_position, 0)
    ) RETURNING id INTO new_id;

    EXECUTE
      'INSERT INTO client_credentials_access_log (credential_id, client_id, actor_id, actor_email, action)
       VALUES ($1, $2, $3, $4, $5)'
      USING new_id, p_client_id, auth.uid(), auth.jwt() ->> 'email', 'create';
  ELSE
    UPDATE client_credentials SET
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
      'INSERT INTO client_credentials_access_log (credential_id, client_id, actor_id, actor_email, action)
       VALUES ($1, $2, $3, $4, $5)'
      USING new_id, p_client_id, auth.uid(), auth.jwt() ->> 'email', 'update';
  END IF;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION upsert_client_credential(uuid, uuid, text, text, text, text, text, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_client_credential(uuid, uuid, text, text, text, text, text, text, int) TO authenticated;

-- delete_client_credential and log_credential_reveal don't touch the encrypted
-- columns, so they keep working as-is from the previous migration.

RESET check_function_bodies;
