-- Allow users to delete their own notifications
CREATE POLICY "notifications_self_delete" ON notifications
  FOR DELETE
  USING (recipient_id = auth.uid());
