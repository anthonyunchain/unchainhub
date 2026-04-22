import { useState, useEffect } from 'react';
import { supabase } from '@/api/base44Client';

async function computeTotal(userId) {
  const { data: parts } = await supabase
    .from('conversation_participants')
    .select('conversation_id, last_read_at')
    .eq('user_id', userId);

  if (!parts?.length) return 0;

  const counts = await Promise.all(
    parts.map(async (p) => {
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', p.conversation_id)
        .gt('created_at', p.last_read_at)
        .neq('sender_id', userId)
        .is('deleted_at', null);
      return count || 0;
    })
  );

  return counts.reduce((a, b) => a + b, 0);
}

export function useUnreadCount(userId) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) return;

    computeTotal(userId).then(setCount);

    const channel = supabase
      .channel(`unread-count-${userId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => computeTotal(userId).then(setCount))
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversation_participants', filter: `user_id=eq.${userId}` },
        () => computeTotal(userId).then(setCount))
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [userId]);

  return count;
}
