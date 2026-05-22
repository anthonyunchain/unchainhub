-- Add is_cancelled flag to content_ideas
-- Cancelled ideas appear greyed out for admins and are hidden from clients.

ALTER TABLE public.content_ideas
  ADD COLUMN IF NOT EXISTS is_cancelled BOOLEAN NOT NULL DEFAULT false;
