import { useEffect } from 'react';
import { supabase } from '@/api/base44Client';

const setBadge = (count) => {
  if (typeof navigator === 'undefined') return;
  try {
    if (count > 0 && typeof navigator.setAppBadge === 'function') {
      navigator.setAppBadge(count);
    } else if (typeof navigator.clearAppBadge === 'function') {
      navigator.clearAppBadge();
    }
  } catch {}
};

async function countUnreadNotifications(userId) {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .eq('is_read', false);
  return error ? 0 : (count || 0);
}

async function countUnreadMessages(userId) {
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

// Mirrors the combined unread notifications + unread chat messages onto the
// installed PWA app icon via the Badging API (iOS 16.4+, macOS Safari,
// Chrome/Edge desktop).
export function useAppBadge(userId) {
  useEffect(() => {
    if (!userId) { setBadge(0); return; }
    let cancelled = false;

    const refresh = async () => {
      const [notifs, msgs] = await Promise.all([
        countUnreadNotifications(userId),
        countUnreadMessages(userId),
      ]);
      if (!cancelled) setBadge(notifs + msgs);
    };

    refresh();

    const salt = Math.random().toString(36).slice(2);
    const channel = supabase
      .channel(`app-badge-${userId}-${salt}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` },
        refresh,
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        refresh,
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversation_participants', filter: `user_id=eq.${userId}` },
        refresh,
      )
      .subscribe();

    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', onVisible);
      setBadge(0);
    };
  }, [userId]);
}
