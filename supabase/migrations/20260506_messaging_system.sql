-- =============================================================================
-- MESSAGING SYSTEM — conversations + participants + messages
-- =============================================================================

-- 1. conversations
CREATE TABLE IF NOT EXISTS public.conversations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type       text NOT NULL DEFAULT 'direct' CHECK (type IN ('direct','group')),
  name       text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON public.conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_created_by ON public.conversations(created_by);

-- 2. conversation_participants
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at        timestamptz NOT NULL DEFAULT now(),
  last_read_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_participants_conv ON public.conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON public.conversation_participants(user_id);

-- 3. messages
CREATE TABLE IF NOT EXISTS public.messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content          text NOT NULL DEFAULT '',
  message_type     text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text','image','file')),
  file_url         text,
  file_name        text,
  reply_to_id      uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  edited_at        timestamptz,
  deleted_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);

-- 4. Trigger: bump conversations.updated_at when a new message is inserted
CREATE OR REPLACE FUNCTION public.update_conversation_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_update_conversation ON public.messages;
CREATE TRIGGER messages_update_conversation
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_conversation_updated_at();

-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user a participant in a given conversation?
-- SECURITY DEFINER avoids recursive RLS lookups.
CREATE OR REPLACE FUNCTION public.is_conversation_participant(conv_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = conv_id AND user_id = auth.uid()
  );
$$;

-- conversations: participants can see their conversations; admins see all
CREATE POLICY "conversations_select" ON public.conversations
  FOR SELECT USING (
    is_admin()
    OR is_conversation_participant(id)
  );

CREATE POLICY "conversations_insert" ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "conversations_update" ON public.conversations
  FOR UPDATE USING (is_admin() OR created_by = auth.uid());

-- conversation_participants: any participant can see all participants of their conversations
CREATE POLICY "conv_participants_select" ON public.conversation_participants
  FOR SELECT USING (
    is_admin()
    OR user_id = auth.uid()
    OR is_conversation_participant(conversation_id)
  );

CREATE POLICY "conv_participants_insert" ON public.conversation_participants
  FOR INSERT WITH CHECK (
    is_admin()
    OR user_id = auth.uid()
  );

-- Participants can update their own last_read_at
CREATE POLICY "conv_participants_self_update" ON public.conversation_participants
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- messages: participants can read; can only insert to their own conversations
CREATE POLICY "messages_select" ON public.messages
  FOR SELECT USING (
    is_admin()
    OR is_conversation_participant(conversation_id)
  );

CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND is_conversation_participant(conversation_id)
  );

-- Sender or admin can soft-delete (update deleted_at)
CREATE POLICY "messages_update" ON public.messages
  FOR UPDATE USING (
    is_admin() OR sender_id = auth.uid()
  );

-- Helper: find an existing direct conversation between two users
CREATE OR REPLACE FUNCTION public.find_direct_conversation(user_a uuid, user_b uuid)
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT c.id
  FROM public.conversations c
  WHERE c.type = 'direct'
    AND EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = c.id AND user_id = user_a)
    AND EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = c.id AND user_id = user_b)
    AND (SELECT COUNT(*) FROM public.conversation_participants WHERE conversation_id = c.id) = 2
  LIMIT 1;
$$;

-- =============================================================================
-- Realtime: publish tables so postgres_changes subscriptions work
-- =============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;

-- =============================================================================
-- Storage bucket for message attachments
-- =============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('messages', 'messages', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY IF NOT EXISTS "messages_bucket_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'messages');

CREATE POLICY IF NOT EXISTS "messages_bucket_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'messages');
