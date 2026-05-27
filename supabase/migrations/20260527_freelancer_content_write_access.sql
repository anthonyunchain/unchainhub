-- ============================================================
-- content_ideas : INSERT / UPDATE / DELETE pour les freelancers
-- Condition : avoir content_ideas_access = true ET le client_name
--             doit faire partie de editorial_client_names du freelancer
-- ============================================================

CREATE POLICY content_ideas_freelancer_insert ON public.content_ideas
FOR INSERT TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.freelancers f
    WHERE f.email = auth.email()
      AND f.content_ideas_access = true
      AND content_ideas.client_name = ANY(f.editorial_client_names)
  )
);

CREATE POLICY content_ideas_freelancer_update ON public.content_ideas
FOR UPDATE TO public
USING (
  EXISTS (
    SELECT 1 FROM public.freelancers f
    WHERE f.email = auth.email()
      AND f.content_ideas_access = true
      AND content_ideas.client_name = ANY(f.editorial_client_names)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.freelancers f
    WHERE f.email = auth.email()
      AND f.content_ideas_access = true
      AND content_ideas.client_name = ANY(f.editorial_client_names)
  )
);

CREATE POLICY content_ideas_freelancer_delete ON public.content_ideas
FOR DELETE TO public
USING (
  EXISTS (
    SELECT 1 FROM public.freelancers f
    WHERE f.email = auth.email()
      AND f.content_ideas_access = true
      AND content_ideas.client_name = ANY(f.editorial_client_names)
  )
);

-- ============================================================
-- editorial_content (calendrier) : INSERT / DELETE pour freelancers
-- Condition : le client_name doit être dans editorial_client_names
-- ============================================================

CREATE POLICY editorial_content_freelancer_insert ON public.editorial_content
FOR INSERT TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.freelancers f
    WHERE f.email = auth.email()
      AND editorial_content.client_name = ANY(f.editorial_client_names)
  )
);

CREATE POLICY editorial_content_freelancer_delete ON public.editorial_content
FOR DELETE TO public
USING (
  EXISTS (
    SELECT 1 FROM public.freelancers f
    WHERE f.email = auth.email()
      AND editorial_content.client_name = ANY(f.editorial_client_names)
  )
);
