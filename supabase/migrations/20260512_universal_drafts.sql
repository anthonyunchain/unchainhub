-- Universal drafts table
-- Stores partial form data for any entity type before final submission
-- Works for freelancers AND clients on all inputs

CREATE TABLE IF NOT EXISTS drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- entity_type: 'task' | 'project' | 'brief' | 'shooting' | 'message' | etc.
  entity_type TEXT NOT NULL,
  -- entity_id: null when creating new, set when editing an existing record
  entity_id UUID,
  content JSONB NOT NULL DEFAULT '{}',
  auto_saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One draft per user per entity type per entity (or null for new items)
CREATE UNIQUE INDEX drafts_unique_idx
  ON drafts (user_id, entity_type, COALESCE(entity_id, '00000000-0000-0000-0000-000000000000'::uuid));

ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own drafts
CREATE POLICY "Users manage own drafts" ON drafts
  FOR ALL USING (user_id = auth.uid());

-- Admins can see all drafts (for review/support)
CREATE POLICY "Admins read all drafts" ON drafts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'staff')
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_drafts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.auto_saved_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER drafts_updated_at
  BEFORE UPDATE ON drafts
  FOR EACH ROW EXECUTE FUNCTION update_drafts_updated_at();
