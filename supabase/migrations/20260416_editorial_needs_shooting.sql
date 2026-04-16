-- Add needs_shooting flag to editorial_content
ALTER TABLE editorial_content ADD COLUMN IF NOT EXISTS needs_shooting boolean NOT NULL DEFAULT true;
