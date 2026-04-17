-- Add ON DELETE CASCADE to all FK constraints pointing at clients.id
-- so that deleting a client also removes all their related data.

ALTER TABLE contracts
  DROP CONSTRAINT IF EXISTS contracts_client_id_fkey,
  ADD CONSTRAINT contracts_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE editorial_content
  DROP CONSTRAINT IF EXISTS editorial_content_client_id_fkey,
  ADD CONSTRAINT editorial_content_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_client_id_fkey,
  ADD CONSTRAINT invoices_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_client_id_fkey,
  ADD CONSTRAINT projects_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_client_id_fkey,
  ADD CONSTRAINT tasks_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
