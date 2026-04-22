-- Per-client list of roles visible in the staff portal. NULL = show all
-- three defaults (chef, manager, pastry). Set explicitly when a client only
-- needs a subset.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS staff_roles text[];
