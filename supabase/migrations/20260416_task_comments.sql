-- =============================================================================
-- TABLE: task_comments
-- Commentaires sur les tâches — admin et freelancers peuvent commenter.
-- Supporte texte + image optionnelle.
-- =============================================================================

CREATE TABLE IF NOT EXISTS task_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL,
  author_name text NOT NULL DEFAULT '',
  author_role text NOT NULL DEFAULT 'freelancer',
  content     text NOT NULL DEFAULT '',
  image_url   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX idx_task_comments_created_at ON task_comments(created_at);

-- =============================================================================
-- RLS
-- =============================================================================
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY "task_comments_admin_all" ON task_comments
  FOR ALL USING (is_admin());

-- Freelancers: can read comments on tasks assigned to them
CREATE POLICY "task_comments_freelancer_read" ON task_comments
  FOR SELECT USING (
    task_id IN (
      SELECT id FROM tasks WHERE assigned_freelancer_id = current_freelancer_id()
    )
  );

-- Freelancers: can insert comments on tasks assigned to them
CREATE POLICY "task_comments_freelancer_insert" ON task_comments
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND task_id IN (
      SELECT id FROM tasks WHERE assigned_freelancer_id = current_freelancer_id()
    )
  );
