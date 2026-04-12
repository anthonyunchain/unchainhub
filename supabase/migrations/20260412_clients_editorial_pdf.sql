-- Add editorial_calendar_pdf column to clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS editorial_calendar_pdf text DEFAULT NULL;
