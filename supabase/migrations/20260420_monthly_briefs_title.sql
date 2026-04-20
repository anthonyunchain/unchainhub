ALTER TABLE monthly_briefs ADD COLUMN IF NOT EXISTS title text DEFAULT '';

-- Allow staff to delete briefs
CREATE POLICY "staff_delete_monthly_briefs" ON monthly_briefs
  FOR DELETE
  USING (get_my_client_name() IS NULL);
