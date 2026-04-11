-- Add "Vie perso" to the allowed values for tasks.category
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_category_check;

ALTER TABLE tasks ADD CONSTRAINT tasks_category_check
  CHECK (category IN ('Commercial', 'Contenu', 'Administratif', 'Montage', 'Vie perso', 'Autre'));
