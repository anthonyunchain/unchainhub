import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/base44Client';

export function useConversations(userId) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['conversations', userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      // Fetch conversations where the user is a participant
      const { data: parts, error: partsErr } = await supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', userId);

      if (partsErr) throw partsErr;
      if (!parts?.length) return [];

      const convIds = parts.map(p => p.conversation_id);
      const lastReadMap = Object.fromEntries(parts.map(p => [p.conversation_id, p.last_read_at]));

      // Fetch conversations with all participants
      const { data: conversations, error: convErr } = await supabase
        .from('conversations')
        .select(`
          id, type, name, created_by, updated_at,
          conversation_participants(user_id, joined_at, last_read_at)
        `)
        .in('id', convIds)
        .order('updated_at', { ascending: false });

      if (convErr) throw convErr;

      // Fetch last message per conversation
      const lastMessagePromises = convIds.map(async (convId) => {
        const { data } = await supabase
          .from('messages')
          .select('id, content, message_type, sender_id, created_at')
          .eq('conversation_id', convId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        return { convId, message: data };
      });

      const lastMessages = await Promise.all(lastMessagePromises);
      const lastMessageMap = Object.fromEntries(lastMessages.map(l => [l.convId, l.message]));

      // Fetch unread counts
      const unreadPromises = convIds.map(async (convId) => {
        const lastRead = lastReadMap[convId];
        if (!lastRead) return { convId, count: 0 };
        const { count } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', convId)
          .gt('created_at', lastRead)
          .neq('sender_id', userId)
          .is('deleted_at', null);
        return { convId, count: count || 0 };
      });

      const unreads = await Promise.all(unreadPromises);
      const unreadMap = Object.fromEntries(unreads.map(u => [u.convId, u.count]));

      // Fetch participant profile names
      const allParticipantIds = [...new Set(
        conversations.flatMap(c => c.conversation_participants.map(p => p.user_id))
      )];

      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('id', allParticipantIds);

      const profileMap = Object.fromEntries((profileRows || []).map(p => [p.id, p]));

      return conversations.map(conv => ({
        ...conv,
        last_message: lastMessageMap[conv.id] || null,
        unread_count: unreadMap[conv.id] || 0,
        participants: conv.conversation_participants.map(p => ({
          ...p,
          profile: profileMap[p.user_id] || null,
        })),
      }));
    },
  });

  // Realtime: re-fetch conversations when a new message arrives
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`conversations-list-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        () => qc.invalidateQueries({ queryKey: ['conversations', userId] }))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_participants', filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ['conversations', userId] }))
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [userId, qc]);

  return query;
}
