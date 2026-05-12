-- Meeting notes: admin-only table to store structured meeting notes per client.

CREATE TABLE IF NOT EXISTS meeting_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid REFERENCES clients(id) ON DELETE SET NULL,
  client_name text,                         -- denormalized for fast display
  date        date NOT NULL DEFAULT CURRENT_DATE,
  title       text NOT NULL DEFAULT '',
  content     text DEFAULT '',
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS meeting_notes_updated_at ON meeting_notes;
CREATE TRIGGER meeting_notes_updated_at
  BEFORE UPDATE ON meeting_notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meeting_notes_date      ON meeting_notes (date DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_client_id ON meeting_notes (client_id);

-- RLS: admin only
ALTER TABLE meeting_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meeting_notes_admin_all" ON meeting_notes;
CREATE POLICY "meeting_notes_admin_all" ON meeting_notes
  FOR ALL USING (is_admin());
