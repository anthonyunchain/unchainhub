-- Add columns needed for Yjs real-time collaboration on notes
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS shared_with_edit uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ydoc_state text;

-- Index for faster edit-permission checks
CREATE INDEX IF NOT EXISTS notes_shared_with_edit_idx ON public.notes USING GIN(shared_with_edit);

-- Allow users with edit permission to update note content
DROP POLICY IF EXISTS "notes_update" ON public.notes;
CREATE POLICY "notes_update" ON public.notes
  FOR UPDATE USING (
    auth.uid() = created_by
    OR auth.uid()::text = ANY(ARRAY(SELECT unnest(shared_with_edit)::text))
  );
