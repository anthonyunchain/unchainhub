-- Fix freelancers_status_check constraint to allow French and English status values
ALTER TABLE freelancers DROP CONSTRAINT IF EXISTS freelancers_status_check;

ALTER TABLE freelancers ADD CONSTRAINT freelancers_status_check
  CHECK (status IN ('Actif', 'Indisponible', 'Active', 'Inactive', 'Unavailable'));
