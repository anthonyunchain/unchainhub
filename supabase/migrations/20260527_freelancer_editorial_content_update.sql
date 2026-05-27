-- Allow freelancers to UPDATE editorial_content for their assigned clients
CREATE POLICY editorial_content_freelancer_update ON public.editorial_content
FOR UPDATE TO public
USING (
  EXISTS (
    SELECT 1 FROM public.freelancers f
    WHERE f.email = auth.email()
      AND editorial_content.client_name = ANY(f.editorial_client_names)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.freelancers f
    WHERE f.email = auth.email()
      AND editorial_content.client_name = ANY(f.editorial_client_names)
  )
);
