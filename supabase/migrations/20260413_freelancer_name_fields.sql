-- Add first_name and last_name columns to freelancers table
ALTER TABLE freelancers
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;
