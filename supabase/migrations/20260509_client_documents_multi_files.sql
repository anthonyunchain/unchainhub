-- Switch client_documents to a multi-file `files` jsonb array
-- (same shape as menu_submissions.files: { path, name, size, type, uploaded_at }).
-- No rows yet, so dropping the single-file columns is safe.

ALTER TABLE client_documents DROP COLUMN IF EXISTS file_path;
ALTER TABLE client_documents DROP COLUMN IF EXISTS file_name;
ALTER TABLE client_documents DROP COLUMN IF EXISTS file_size;
ALTER TABLE client_documents DROP COLUMN IF EXISTS mime_type;

ALTER TABLE client_documents
  ADD COLUMN IF NOT EXISTS files jsonb NOT NULL DEFAULT '[]'::jsonb;
