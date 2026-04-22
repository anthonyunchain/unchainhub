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

// Mirrors the unread-notification count onto the installed PWA app icon
// via the Badging API (iOS 16.4+, macOS Safari, Chrome/Edge desktop).
export function useAppBadge(userId) {
  useEffect(() => {
    if (!userId) { setBadge(0); return; }
    let cancelled = false;

    const refresh = async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .eq('is_read', false);
      if (!cancelled && !error) setBadge(count || 0);
    };

    refresh();

    const channel = supabase
      .channel(`app-badge-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` },
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
