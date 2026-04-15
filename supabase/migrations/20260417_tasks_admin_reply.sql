-- Admin can reply to a freelancer's note on a task
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS admin_reply text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS admin_reply_at timestamptz;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS admin_reply_author text;
