-- Portal V2: token-based client portal fields

-- clients table
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS portal_token uuid DEFAULT gen_random_uuid() UNIQUE,
  ADD COLUMN IF NOT EXISTS production_schedule_pdfs text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS training_pdf_url text;

-- Backfill any existing clients that have a null token
UPDATE clients SET portal_token = gen_random_uuid() WHERE portal_token IS NULL;

-- editorial_content table
ALTER TABLE editorial_content
  ADD COLUMN IF NOT EXISTS drive_url text,
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS reel_description text;

-- client_push_subscriptions for token-based (unauthenticated) portal users
CREATE TABLE IF NOT EXISTS client_push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- RLS: only service role (edge functions) can read/write
ALTER TABLE client_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON client_push_subscriptions
  USING (false)
  WITH CHECK (false);
