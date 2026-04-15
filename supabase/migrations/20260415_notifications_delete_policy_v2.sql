-- Fix: freelancers could not delete their own notifications because the
-- previous policy only allowed recipient_id = auth.uid(), but freelancer
-- notifications are stored with recipient_id = current_freelancer_id()
-- (i.e. the freelancers.id, not the auth.users.id).

DROP POLICY IF EXISTS "notifications_self_delete" ON notifications;

CREATE POLICY "notifications_self_delete" ON notifications
  FOR DELETE
  USING (
    recipient_id = current_freelancer_id()
    OR recipient_id = auth.uid()
  );
