-- Add default_language column to clients (for client portal default language)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS default_language text NOT NULL DEFAULT 'en';
