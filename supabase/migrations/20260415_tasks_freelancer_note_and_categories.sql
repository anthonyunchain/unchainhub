-- 1) Add freelancer_note column (freelancer can leave a note / question for admin)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS freelancer_note text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS freelancer_note_updated_at timestamptz;

-- 2) Relax / update the category check constraint to include the new English
--    category set (including Web) while keeping legacy French values so old
--    rows don't break.
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_category_check;

ALTER TABLE tasks ADD CONSTRAINT tasks_category_check
  CHECK (category IN (
    -- new canonical values
    'Design', 'Video Editing', 'Analytics', 'Administrative',
    'Posting', 'Update', 'Personal', 'Web',
    -- legacy values (kept for backward compatibility)
    'Commercial', 'Contenu', 'Administratif', 'Montage', 'Vie perso', 'Autre'
  ));
