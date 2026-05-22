-- Add 'Annulé' to the editorial_content status CHECK constraint.
-- The UI already exposes "Cancelled" → 'Annulé' but the constraint was missing it.

ALTER TABLE public.editorial_content
  DROP CONSTRAINT IF EXISTS editorial_content_status_check;

ALTER TABLE public.editorial_content
  ADD CONSTRAINT editorial_content_status_check
  CHECK (status = ANY (ARRAY['Planifié'::text, 'En cours'::text, 'Tourné'::text, 'Monté'::text, 'Publié'::text, 'Annulé'::text]));
