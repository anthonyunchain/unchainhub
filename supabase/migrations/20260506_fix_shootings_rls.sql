-- Fix: enable RLS on shootings tables that were publicly accessible
ALTER TABLE public.shootings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shooting_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shooting_content ENABLE ROW LEVEL SECURITY;

-- shootings: admins full access
CREATE POLICY "shootings_admin_all" ON public.shootings
  FOR ALL USING (is_admin());

-- Freelancers can read shootings they're assigned to
CREATE POLICY "shootings_freelancer_read" ON public.shootings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.shooting_assignments sa
      WHERE sa.shooting_id = shootings.id
        AND sa.freelancer_id = current_freelancer_id()
    )
  );

-- Clients can read their own shootings
CREATE POLICY "shootings_client_read" ON public.shootings
  FOR SELECT USING (
    client_name IN (
      SELECT company_name FROM public.clients
      WHERE portal_user_id = auth.uid()
         OR contact_email = auth.email()
    )
  );

-- shooting_assignments
CREATE POLICY "shooting_assignments_admin_all" ON public.shooting_assignments
  FOR ALL USING (is_admin());

CREATE POLICY "shooting_assignments_freelancer_read" ON public.shooting_assignments
  FOR SELECT USING (freelancer_id = current_freelancer_id());

-- shooting_content
CREATE POLICY "shooting_content_admin_all" ON public.shooting_content
  FOR ALL USING (is_admin());

CREATE POLICY "shooting_content_freelancer_read" ON public.shooting_content
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.shooting_assignments sa
      WHERE sa.shooting_id = shooting_content.shooting_id
        AND sa.freelancer_id = current_freelancer_id()
    )
  );

CREATE POLICY "shooting_content_client_read" ON public.shooting_content
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.shootings s
      WHERE s.id = shooting_content.shooting_id
        AND s.client_name IN (
          SELECT company_name FROM public.clients
          WHERE portal_user_id = auth.uid()
             OR contact_email = auth.email()
        )
    )
  );
