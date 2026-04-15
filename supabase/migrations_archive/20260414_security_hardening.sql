-- ─────────────────────────────────────────────────────────────────────────────
-- Security hardening — 2026-04-14
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Remove the overly-permissive policy that allowed ANY authenticated user
--    to read admin profile IDs from the profiles table.
--    Admin IDs are resolved server-side (edge functions use service_role key).
DROP POLICY IF EXISTS "profiles_admin_id_read" ON profiles;

-- 2. Tighten the notifications INSERT policy.
--    Only admins (via service_role key in edge functions) should insert notifications.
--    Freelancers should never be able to send notifications directly from the client.
DROP POLICY IF EXISTS "notifications_authenticated_insert" ON notifications;

CREATE POLICY "notifications_admin_insert" ON notifications
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );

-- 3. Allow service_role (edge functions) to bypass RLS for notification inserts.
--    This is already the case since service_role bypasses RLS by default in Supabase,
--    but we make the intent explicit here as a comment.
-- NOTE: Edge functions use supabaseAdmin (service_role key) which bypasses RLS entirely.
--       The INSERT policy above only applies to anon/authenticated role calls.

-- 4. Tighten the notifications DELETE policy to ensure users can only delete
--    their own notifications (belt-and-suspenders with the edge function check).
DROP POLICY IF EXISTS "notifications_self_delete" ON notifications;

CREATE POLICY "notifications_self_delete" ON notifications
  FOR DELETE
  USING (
    recipient_id = auth.uid()
  );

-- 5. Tighten the notifications UPDATE policy.
DROP POLICY IF EXISTS "notifications_self_update" ON notifications;

CREATE POLICY "notifications_self_update" ON notifications
  FOR UPDATE
  USING (
    recipient_id = auth.uid()
  )
  WITH CHECK (
    recipient_id = auth.uid()
  );
