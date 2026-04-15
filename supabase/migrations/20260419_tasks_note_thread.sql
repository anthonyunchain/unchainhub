-- Replace the single note + single reply fields with a proper conversation
-- thread on the task (JSONB array of message objects).
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS note_thread jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Backfill: migrate any existing freelancer_note / admin_reply into the thread.
-- Message shape: { id, author_role, author_name, text, created_at }
UPDATE tasks
SET note_thread = (
  COALESCE(
    CASE
      WHEN freelancer_note IS NOT NULL AND trim(freelancer_note) <> '' THEN
        jsonb_build_array(jsonb_build_object(
          'id', gen_random_uuid(),
          'author_role', 'freelancer',
          'author_name', COALESCE(assigned_to, 'Freelancer'),
          'text', freelancer_note,
          'created_at', COALESCE(freelancer_note_updated_at, now())
        ))
      ELSE '[]'::jsonb
    END
  )
  ||
  CASE
    WHEN admin_reply IS NOT NULL AND trim(admin_reply) <> '' THEN
      jsonb_build_array(jsonb_build_object(
        'id', gen_random_uuid(),
        'author_role', 'admin',
        'author_name', COALESCE(admin_reply_author, 'Admin'),
        'text', admin_reply,
        'created_at', COALESCE(admin_reply_at, now())
      ))
    ELSE '[]'::jsonb
  END
)
WHERE (note_thread IS NULL OR note_thread = '[]'::jsonb)
  AND ((freelancer_note IS NOT NULL AND trim(freelancer_note) <> '')
    OR (admin_reply IS NOT NULL AND trim(admin_reply) <> ''));

NOTIFY pgrst, 'reload schema';
