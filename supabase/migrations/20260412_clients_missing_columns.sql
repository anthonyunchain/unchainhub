-- Add missing columns to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at        timestamptz  DEFAULT now();
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contract_documents text[]       DEFAULT '{}';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS invoice_documents  text[]       DEFAULT '{}';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS editorial_visible  boolean      DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS "order"            integer      DEFAULT 0;
