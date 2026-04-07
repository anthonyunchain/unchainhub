-- =============================================================================
-- ROW LEVEL SECURITY — UnchainHub
-- =============================================================================
-- Principe :
--   • Admins (profiles.role = 'admin') → accès total en lecture/écriture
--   • Freelancers (dans la table freelancers) → accès restreint à leurs données
--   • Tout autre utilisateur authentifié → aucun accès
--   • Non authentifié → aucun accès
--
-- Helper function : retourne true si l'utilisateur connecté est admin
-- =============================================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$;

-- Helper : retourne l'id du freelancer associé à l'utilisateur connecté (ou null)
CREATE OR REPLACE FUNCTION current_freelancer_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM freelancers
  WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  LIMIT 1;
$$;

-- =============================================================================
-- TABLE: profiles
-- Chaque utilisateur peut lire son propre profil. Admins lisent tout.
-- =============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_admin_all" ON profiles
  FOR ALL USING (is_admin());

CREATE POLICY "profiles_self_read" ON profiles
  FOR SELECT USING (id = auth.uid());

-- =============================================================================
-- TABLE: clients
-- Admins seulement.
-- =============================================================================
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_admin_all" ON clients
  FOR ALL USING (is_admin());

-- =============================================================================
-- TABLE: prospects
-- Admins seulement.
-- =============================================================================
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prospects_admin_all" ON prospects
  FOR ALL USING (is_admin());

-- =============================================================================
-- TABLE: client_stats
-- Admins seulement.
-- =============================================================================
ALTER TABLE client_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_stats_admin_all" ON client_stats
  FOR ALL USING (is_admin());

-- =============================================================================
-- TABLE: contact_logs
-- Admins seulement.
-- =============================================================================
ALTER TABLE contact_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contact_logs_admin_all" ON contact_logs
  FOR ALL USING (is_admin());

-- =============================================================================
-- TABLE: templates
-- Admins seulement.
-- =============================================================================
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates_admin_all" ON templates
  FOR ALL USING (is_admin());

-- =============================================================================
-- TABLE: services
-- Admins seulement.
-- =============================================================================
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services_admin_all" ON services
  FOR ALL USING (is_admin());

-- =============================================================================
-- TABLE: contracts
-- Admins seulement.
-- =============================================================================
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contracts_admin_all" ON contracts
  FOR ALL USING (is_admin());

-- =============================================================================
-- TABLE: invoices
-- Admins seulement.
-- =============================================================================
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_admin_all" ON invoices
  FOR ALL USING (is_admin());

-- =============================================================================
-- TABLE: freelancers
-- Admins → tout. Freelancer → peut lire sa propre ligne uniquement.
-- =============================================================================
ALTER TABLE freelancers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "freelancers_admin_all" ON freelancers
  FOR ALL USING (is_admin());

CREATE POLICY "freelancers_self_read" ON freelancers
  FOR SELECT USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- =============================================================================
-- TABLE: freelancer_payments
-- Admins → tout. Freelancer → ses propres paiements.
-- =============================================================================
ALTER TABLE freelancer_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "freelancer_payments_admin_all" ON freelancer_payments
  FOR ALL USING (is_admin());

CREATE POLICY "freelancer_payments_self_read" ON freelancer_payments
  FOR SELECT USING (freelancer_id = current_freelancer_id());

CREATE POLICY "freelancer_payments_self_insert" ON freelancer_payments
  FOR INSERT WITH CHECK (freelancer_id = current_freelancer_id());

-- =============================================================================
-- TABLE: freelancer_meetings
-- Admins → tout. Freelancer → ses propres meetings.
-- =============================================================================
ALTER TABLE freelancer_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "freelancer_meetings_admin_all" ON freelancer_meetings
  FOR ALL USING (is_admin());

CREATE POLICY "freelancer_meetings_self_read" ON freelancer_meetings
  FOR SELECT USING (freelancer_id = current_freelancer_id());

-- =============================================================================
-- TABLE: freelancer_tools
-- Admins → tout. Freelancers → lecture seule (outils partagés).
-- =============================================================================
ALTER TABLE freelancer_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "freelancer_tools_admin_all" ON freelancer_tools
  FOR ALL USING (is_admin());

CREATE POLICY "freelancer_tools_freelancer_read" ON freelancer_tools
  FOR SELECT USING (current_freelancer_id() IS NOT NULL);

-- =============================================================================
-- TABLE: projects
-- Admins → tout. Freelancer → ses projets assignés.
-- =============================================================================
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_admin_all" ON projects
  FOR ALL USING (is_admin());

CREATE POLICY "projects_freelancer_read" ON projects
  FOR SELECT USING (freelancer_id = current_freelancer_id());

-- =============================================================================
-- TABLE: tasks
-- Admins → tout. Freelancer → ses tâches assignées.
-- =============================================================================
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_admin_all" ON tasks
  FOR ALL USING (is_admin());

CREATE POLICY "tasks_freelancer_read" ON tasks
  FOR SELECT USING (assigned_freelancer_id = current_freelancer_id());

-- =============================================================================
-- TABLE: admin_tasks
-- Admins seulement.
-- =============================================================================
ALTER TABLE admin_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_tasks_admin_all" ON admin_tasks
  FOR ALL USING (is_admin());

-- =============================================================================
-- TABLE: board_meetings
-- Admins seulement.
-- =============================================================================
ALTER TABLE board_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "board_meetings_admin_all" ON board_meetings
  FOR ALL USING (is_admin());

-- =============================================================================
-- TABLE: legal_documents
-- Admins seulement.
-- =============================================================================
ALTER TABLE legal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "legal_documents_admin_all" ON legal_documents
  FOR ALL USING (is_admin());

-- =============================================================================
-- TABLE: shareholders
-- Admins seulement.
-- =============================================================================
ALTER TABLE shareholders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shareholders_admin_all" ON shareholders
  FOR ALL USING (is_admin());

-- =============================================================================
-- TABLE: shareholder_salaries
-- Admins seulement.
-- =============================================================================
ALTER TABLE shareholder_salaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shareholder_salaries_admin_all" ON shareholder_salaries
  FOR ALL USING (is_admin());

-- =============================================================================
-- TABLE: editorial_content
-- Admins → tout.
-- Freelancers → lecture seule sur les clients avec editorial_visible = true.
-- Freelancers → update sur description uniquement (géré par edge function).
-- =============================================================================
ALTER TABLE editorial_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "editorial_content_admin_all" ON editorial_content
  FOR ALL USING (is_admin());

CREATE POLICY "editorial_content_freelancer_read" ON editorial_content
  FOR SELECT USING (
    current_freelancer_id() IS NOT NULL
    AND client_name IN (
      SELECT company_name FROM clients WHERE editorial_visible = true
    )
  );

-- =============================================================================
-- TABLE: personal_tasks
-- Chaque utilisateur voit et gère uniquement ses propres tâches personnelles.
-- =============================================================================
ALTER TABLE personal_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "personal_tasks_admin_all" ON personal_tasks
  FOR ALL USING (is_admin());

CREATE POLICY "personal_tasks_owner_all" ON personal_tasks
  FOR ALL USING (user_id = auth.uid());
