-- Align CHECK constraints with the statuses the Production UI can actually set.
-- The UI added "Subtitles" (projects + editorial) and uses "Draft" (projects) and
-- "En attente d'acceptation" (editorial), none of which were in the DB constraints,
-- so saving a project/editorial item with those statuses failed with
-- *_status_check violations. These are supersets of the previous allowed values,
-- so no existing row becomes invalid.

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_status_check
  CHECK (status = ANY (ARRAY[
    'Draft','Unassigned','Active','Pending acceptance','Accepted',
    'In progress','Delivered','Revision requested','Subtitles',
    'Completed','Cancelled','On hold'
  ]));

ALTER TABLE public.editorial_content DROP CONSTRAINT IF EXISTS editorial_content_editing_status_check;
ALTER TABLE public.editorial_content ADD CONSTRAINT editorial_content_editing_status_check
  CHECK (editing_status = ANY (ARRAY[
    'Non assigné','En attente d''acceptation','À faire','En cours de montage',
    'En attente de retour','Subtitles','Terminé'
  ]));
