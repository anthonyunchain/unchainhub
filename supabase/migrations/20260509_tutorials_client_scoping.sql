-- Scope tutorials to specific clients via a client_ids uuid[] column.
-- NULL or empty array = global (visible to every authenticated user, same as today).
-- Non-empty = visible only to users tied to one of those clients (portal login,
-- contact email, or linked staff account).

ALTER TABLE tutorials
  ADD COLUMN IF NOT EXISTS client_ids uuid[];

CREATE INDEX IF NOT EXISTS idx_tutorials_client_ids ON tutorials USING gin (client_ids);

-- Replace the blanket read policy with a scoped one.
DROP POLICY IF EXISTS "tutorials_authenticated_read" ON tutorials;
CREATE POLICY "tutorials_authenticated_read" ON tutorials
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (
      client_ids IS NULL
      OR array_length(client_ids, 1) IS NULL
      OR EXISTS (
        SELECT 1 FROM clients c
        WHERE c.id = ANY(client_ids)
          AND (
            c.portal_user_id = auth.uid()
            OR c.contact_email = auth.email()
            OR c.staff_user_id = auth.uid()
          )
      )
    )
  );
