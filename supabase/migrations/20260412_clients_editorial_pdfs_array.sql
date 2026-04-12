-- Replace single editorial_calendar_pdf with array for history
ALTER TABLE clients ADD COLUMN IF NOT EXISTS editorial_calendar_pdfs text[] DEFAULT '{}';
-- Migrate existing single PDF to array if column existed
UPDATE clients SET editorial_calendar_pdfs = ARRAY[editorial_calendar_pdf] WHERE editorial_calendar_pdf IS NOT NULL AND (editorial_calendar_pdfs IS NULL OR editorial_calendar_pdfs = '{}');
