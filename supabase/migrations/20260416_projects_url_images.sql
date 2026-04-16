-- Add URL and images to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS url text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS images jsonb NOT NULL DEFAULT '[]'::jsonb;
