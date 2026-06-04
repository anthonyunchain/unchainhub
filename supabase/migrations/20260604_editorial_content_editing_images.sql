-- Video workflow: reference images for the editor on editorial_content.
--
-- The Editorial dialog now has an Editorial/Video workflow toggle. In "video"
-- mode the content is edited through a project-style window (title, client,
-- editor, editing status, description, URL, notes, brief files, images) while
-- staying a single editorial_content row (Option A — single source of truth).
--
-- `editing_files` already holds brief/reference files (any type); this adds a
-- dedicated array for reference images so they render as a thumbnail grid,
-- mirroring the standalone projects "Images" field.
-- (Already applied to the production DB on 2026-06-04 via MCP; kept for history.)

ALTER TABLE editorial_content
  ADD COLUMN IF NOT EXISTS editing_images text[] DEFAULT '{}';
