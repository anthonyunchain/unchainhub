-- =============================================================================
-- CLIENT DOCUMENTS
-- =============================================================================
-- Admin uploads PDFs (or images) with a title on a client's page. Staff
-- (any role linked via clients.staff_user_id) and the client itself (portal
-- login) can read and download them.
-- =============================================================================

CREATE TABLE IF NOT EXISTS client_documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title       text NOT NULL,
  file_path   text NOT NULL,
  file_name   text NOT NULL,
  file_size   bigint,
  mime_type   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_documents_client_id  ON client_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_created_at ON client_documents(created_at DESC);

CREATE OR REPLACE FUNCTION client_documents_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_documents_touch ON client_documents;
CREATE TRIGGER trg_client_documents_touch
  BEFORE UPDATE ON client_documents
  FOR EACH ROW EXECUTE FUNCTION client_documents_touch_updated_at();

-- RLS
ALTER TABLE client_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_documents_admin_all" ON client_documents
  FOR ALL USING (is_admin());

-- Staff: read docs for the client they belong to
CREATE POLICY "client_documents_staff_read" ON client_documents
  FOR SELECT USING (
    client_id = current_staff_client_id()
    AND current_staff_client_id() IS NOT NULL
  );

-- Client portal user: read their own client's docs
CREATE POLICY "client_documents_client_read" ON client_documents
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM clients
      WHERE portal_user_id = auth.uid()
         OR contact_email = auth.email()
    )
  );

-- =============================================================================
-- STORAGE BUCKET: client-documents
-- Files organized under {client_id}/{filename}
-- =============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-documents', 'client-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "client_documents_bucket_admin_all" ON storage.objects;
CREATE POLICY "client_documents_bucket_admin_all" ON storage.objects
  FOR ALL USING (bucket_id = 'client-documents' AND is_admin());

-- Staff: read-only, scoped to their client folder
DROP POLICY IF EXISTS "client_documents_bucket_staff_read" ON storage.objects;
CREATE POLICY "client_documents_bucket_staff_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'client-documents'
    AND current_staff_client_id() IS NOT NULL
    AND (storage.foldername(name))[1] = current_staff_client_id()::text
  );

-- Client portal: read-only, scoped to their own client folder
DROP POLICY IF EXISTS "client_documents_bucket_client_read" ON storage.objects;
CREATE POLICY "client_documents_bucket_client_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'client-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM clients
      WHERE portal_user_id = auth.uid()
         OR contact_email = auth.email()
    )
  );
