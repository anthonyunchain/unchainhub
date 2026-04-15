-- Ensure the assigned_freelancer_id column exists on tasks (legacy env fix)
-- and force PostgREST to reload its schema cache.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_freelancer_id uuid;

-- Refresh PostgREST schema cache so the column is visible through the API.
NOTIFY pgrst, 'reload schema';
