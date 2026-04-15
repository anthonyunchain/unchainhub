-- Defense-in-depth for the note_thread column:
--   1) Cap each message text at 5000 chars (truncate).
--   2) Cap the thread at 500 messages (keep the most recent).
--   3) Reject messages whose author_role isn't one of the known values.
--   4) Enforce that a freelancer sitting on an assigned task can only
--      append messages with author_role = 'freelancer' (they cannot forge
--      an admin message). Admins (service_role, or admin role) may insert
--      both roles (since they hold tasks_admin_all RLS and are trusted).
--
-- The trigger runs on INSERT/UPDATE of the note_thread column only so
-- the common path (admins editing other fields) stays cheap.

CREATE OR REPLACE FUNCTION public.tasks_sanitize_note_thread()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin_caller boolean := false;
  caller_role text;
  sanitized jsonb := '[]'::jsonb;
  msg jsonb;
  role_value text;
  text_value text;
  max_msg_len constant int := 5000;
  max_thread_len constant int := 500;
  arr jsonb;
  start_idx int;
BEGIN
  -- Null/empty → force empty array.
  IF NEW.note_thread IS NULL THEN
    NEW.note_thread := '[]'::jsonb;
    RETURN NEW;
  END IF;

  -- Must be an array.
  IF jsonb_typeof(NEW.note_thread) <> 'array' THEN
    RAISE EXCEPTION 'note_thread must be a JSON array';
  END IF;

  -- Identify whether the caller is an admin / service_role.
  SELECT current_setting('request.jwt.claims', true)::jsonb->>'role'
  INTO caller_role;

  IF caller_role = 'service_role' THEN
    is_admin_caller := true;
  ELSIF auth.uid() IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    ) INTO is_admin_caller;
  END IF;

  -- Trim the array to the last max_thread_len messages.
  arr := NEW.note_thread;
  IF jsonb_array_length(arr) > max_thread_len THEN
    start_idx := jsonb_array_length(arr) - max_thread_len;
    arr := (
      SELECT COALESCE(jsonb_agg(value), '[]'::jsonb)
      FROM (
        SELECT value, ord
        FROM jsonb_array_elements(arr) WITH ORDINALITY AS t(value, ord)
        ORDER BY ord
        OFFSET start_idx
      ) AS sub
    );
  END IF;

  -- Walk each message; validate role and truncate text.
  FOR msg IN SELECT value FROM jsonb_array_elements(arr) LOOP
    IF jsonb_typeof(msg) <> 'object' THEN
      RAISE EXCEPTION 'note_thread entries must be objects';
    END IF;

    role_value := msg->>'author_role';
    IF role_value IS NULL OR role_value NOT IN ('admin', 'freelancer') THEN
      RAISE EXCEPTION 'note_thread entries must have author_role in (admin, freelancer)';
    END IF;

    -- Non-admin callers can ONLY write freelancer messages.
    IF role_value = 'admin' AND NOT is_admin_caller THEN
      RAISE EXCEPTION 'Only admin callers may append admin messages to note_thread';
    END IF;

    text_value := COALESCE(msg->>'text', '');
    IF length(text_value) > max_msg_len THEN
      text_value := left(text_value, max_msg_len);
      msg := jsonb_set(msg, '{text}', to_jsonb(text_value), true);
    END IF;

    sanitized := sanitized || jsonb_build_array(msg);
  END LOOP;

  NEW.note_thread := sanitized;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_note_thread_sanitize ON tasks;

CREATE TRIGGER tasks_note_thread_sanitize
  BEFORE INSERT OR UPDATE OF note_thread ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.tasks_sanitize_note_thread();
