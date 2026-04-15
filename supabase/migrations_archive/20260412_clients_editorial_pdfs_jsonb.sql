-- Change editorial_calendar_pdfs from text[] to jsonb to store {month, url} objects
ALTER TABLE clients DROP COLUMN IF EXISTS editorial_calendar_pdfs;
ALTER TABLE clients ADD COLUMN editorial_calendar_pdfs jsonb DEFAULT '[]';
