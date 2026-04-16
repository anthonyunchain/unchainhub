-- ─── MIGRATION: Notes system + user_tags + freelancer user_id ────────────────

-- 1. Add user_id to freelancers (needed for invoice paid notifications)
ALTER TABLE public.freelancers
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS freelancers_user_id_idx ON public.freelancers(user_id);

-- Backfill user_id by matching email against auth.users
UPDATE public.freelancers f
SET user_id = u.id
FROM auth.users u
WHERE u.email = f.email
  AND f.user_id IS NULL;

-- 2. Notes table
CREATE TABLE IF NOT EXISTS public.notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL DEFAULT '',
  content     text NOT NULL DEFAULT '',
  tags        text[] NOT NULL DEFAULT '{}',
  created_by  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with uuid[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 3. User tags (personal tags per user, independent across users)
CREATE TABLE IF NOT EXISTS public.user_tags (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  color      text NOT NULL DEFAULT '#6B7280',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

-- 4. Auto-update trigger for notes.updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notes_updated_at ON public.notes;
CREATE TRIGGER notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. RLS: notes
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notes_select" ON public.notes;
CREATE POLICY "notes_select" ON public.notes
  FOR SELECT USING (
    auth.uid() = created_by
    OR auth.uid() = ANY(shared_with)
  );

DROP POLICY IF EXISTS "notes_insert" ON public.notes;
CREATE POLICY "notes_insert" ON public.notes
  FOR INSERT WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "notes_update" ON public.notes;
CREATE POLICY "notes_update" ON public.notes
  FOR UPDATE USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "notes_delete" ON public.notes;
CREATE POLICY "notes_delete" ON public.notes
  FOR DELETE USING (auth.uid() = created_by);

-- 6. RLS: user_tags (full access to own tags only)
ALTER TABLE public.user_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_tags_all" ON public.user_tags;
CREATE POLICY "user_tags_all" ON public.user_tags
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7. Indexes for performance
CREATE INDEX IF NOT EXISTS notes_created_by_idx ON public.notes(created_by);
CREATE INDEX IF NOT EXISTS notes_updated_at_idx ON public.notes(updated_at DESC);
CREATE INDEX IF NOT EXISTS notes_shared_with_idx ON public.notes USING GIN(shared_with);
CREATE INDEX IF NOT EXISTS notes_tags_idx ON public.notes USING GIN(tags);
CREATE INDEX IF NOT EXISTS user_tags_user_id_idx ON public.user_tags(user_id);
