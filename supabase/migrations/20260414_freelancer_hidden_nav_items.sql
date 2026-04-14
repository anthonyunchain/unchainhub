-- Add hidden_nav_items column to freelancers table
-- Stores an array of nav item IDs to hide for a specific freelancer
ALTER TABLE freelancers
  ADD COLUMN IF NOT EXISTS hidden_nav_items text[] NOT NULL DEFAULT '{}';

-- Hide Calendar (projects), Tools, and Meetings for Domnin
UPDATE freelancers
  SET hidden_nav_items = ARRAY['projects', 'tools', 'meetings']
  WHERE id = 'a83475b8-6afe-45c8-bbfb-7afcbbabfe54';
