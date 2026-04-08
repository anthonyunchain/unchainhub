-- Allow freelancers to update status/delivery_url on their own projects
CREATE POLICY "projects_freelancer_update" ON projects
  FOR UPDATE USING (freelancer_id = current_freelancer_id());

-- Allow authenticated users to insert notifications (for freelancer → admin flow)
CREATE POLICY "notifications_authenticated_insert" ON notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Allow users to read their own notifications
CREATE POLICY "notifications_self_read" ON notifications
  FOR SELECT USING (
    recipient_id = current_freelancer_id()
    OR recipient_id = auth.uid()
  );

-- Allow users to update (mark read) their own notifications
CREATE POLICY "notifications_self_update" ON notifications
  FOR UPDATE USING (
    recipient_id = current_freelancer_id()
    OR recipient_id = auth.uid()
  );
