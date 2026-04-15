-- Ensure clients table has updated_at column
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
