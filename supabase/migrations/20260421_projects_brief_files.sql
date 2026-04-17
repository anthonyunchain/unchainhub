-- Add brief_files column to projects for admin-uploaded reference files
ALTER TABLE projects ADD COLUMN IF NOT EXISTS brief_files jsonb DEFAULT '[]';
