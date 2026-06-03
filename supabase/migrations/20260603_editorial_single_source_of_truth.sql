-- Option A: editorial_content is the single source of truth for video editing.
--
-- The old flow auto-created a row in `projects` (linked via
-- editorial_content.linked_project_id) whenever a content piece switched to the
-- "video" workflow. That produced a duplicate record per video (one in
-- editorial_content, one in projects), two divergent status systems, and orphan
-- projects when the link was severed. We now track video editing entirely on
-- editorial_content via `editing_status`; `projects` is reserved for standalone
-- video projects created from the admin Projects tab.
--
-- This migration removes the redundant linked projects and clears the links.
-- (Already applied to the production DB on 2026-06-03; kept here for history.)

-- 1) Surface active editing work that the old flow had toggled out of production.
update editorial_content
set in_production = true
where linked_project_id is not null
  and editing_status is not null
  and editing_status not in ('Terminé', 'Non assigné');

-- 2) Delete the now-redundant auto-created linked projects.
delete from projects
where id in (select linked_project_id from editorial_content where linked_project_id is not null);

-- 3) Drop the dangling links.
update editorial_content
set linked_project_id = null
where linked_project_id is not null;
