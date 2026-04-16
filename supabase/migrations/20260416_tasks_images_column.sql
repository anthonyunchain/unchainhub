-- Add images array to tasks table (task-level attachments from admin)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS images jsonb NOT NULL DEFAULT '[]'::jsonb;
