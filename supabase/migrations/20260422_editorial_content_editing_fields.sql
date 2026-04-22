-- Editorial content: add editing_instructions + editing_files for the
-- Video Editing workflow (reference files uploaded in the Edit content modal).
ALTER TABLE public.editorial_content
  ADD COLUMN IF NOT EXISTS editing_instructions text,
  ADD COLUMN IF NOT EXISTS editing_files text[] DEFAULT '{}'::text[];
