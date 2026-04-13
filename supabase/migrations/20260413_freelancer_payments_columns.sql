-- Add missing columns to freelancer_payments
ALTER TABLE freelancer_payments ADD COLUMN IF NOT EXISTS client_name text;
ALTER TABLE freelancer_payments ADD COLUMN IF NOT EXISTS mission text;
ALTER TABLE freelancer_payments ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE freelancer_payments ADD COLUMN IF NOT EXISTS invoice_url text;
ALTER TABLE freelancer_payments ADD COLUMN IF NOT EXISTS date date;
ALTER TABLE freelancer_payments ADD COLUMN IF NOT EXISTS freelancer_id uuid;
ALTER TABLE freelancer_payments ADD COLUMN IF NOT EXISTS freelancer_name text;
ALTER TABLE freelancer_payments ADD COLUMN IF NOT EXISTS status text DEFAULT 'En attente';
ALTER TABLE freelancer_payments ADD COLUMN IF NOT EXISTS amount numeric(12,2) DEFAULT 0;
