import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/base44Client';

export function useMessages(conversationId, userId) {
  const qc = useQueryClient();
  const markedRef = useRef(null);

  const query = useQuery({
    queryKey: ['messages', conversationId],
    enabled: !!conversationId,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  // Realtime: append incoming messages live
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`messages-${conversationId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          qc.setQueryData(['messages', conversationId], (old = []) => {
            // Avoid duplicate if we already have this message (from optimistic insert)
            if (old.find(m => m.id === payload.new.id)) return old;
            return [...old, payload.new];
          });
          // Refresh unread counts
          if (userId) qc.invalidateQueries({ queryKey: ['conversations'] });
        })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [conversationId, userId, qc]);

  // Mark as read when the conversation is opened
  useEffect(() => {
    if (!conversationId || !userId) return;
    if (markedRef.current === conversationId) return;
    markedRef.current = conversationId;

    supabase
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .then(() => {
        qc.invalidateQueries({ queryKey: ['conversations', userId] });
      });
  }, [conversationId, userId, qc]);

  return query;
}

export async function sendMessage({ conversationId, senderId, content, messageType = 'text', fileUrl = null, fileName = null, replyToId = null }) {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: content || '',
      message_type: messageType,
      file_url: fileUrl,
      file_name: fileName,
      reply_to_id: replyToId,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
