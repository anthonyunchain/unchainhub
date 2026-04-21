import { supabase } from '@/api/base44Client';

const VAPID_PUBLIC_KEY = 'BEJ8xUeXYtAfm7W36wbzHvxBvczopyE_lRKQIezMB7-dR6LPvWf5LesbrjmXXcQrCA7GLQmMYk66y6UGUjOdFMI';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

// Heuristic: iOS Safari in a regular browser tab cannot subscribe to push.
// Must be installed as a standalone PWA (Add to Home Screen) on iOS 16.4+.
function isIosStandalone() {
  return typeof navigator !== 'undefined'
    && /iP(ad|hone|od)/.test(navigator.userAgent)
    && window.matchMedia?.('(display-mode: standalone)')?.matches === true;
}

function isIosBrowserTab() {
  return typeof navigator !== 'undefined'
    && /iP(ad|hone|od)/.test(navigator.userAgent)
    && !isIosStandalone();
}

/**
 * Returns whether push notifications are supported on this browser/device.
 * Possible values:
 *   'supported'       → PushManager available, we can try to subscribe
 *   'ios-install'     → iOS browser tab — user needs to install PWA to home screen
 *   'unsupported'     → Browser has no push API at all
 */
export function getPushSupport() {
  if (typeof window === 'undefined') return 'unsupported';
  if (isIosBrowserTab()) return 'ios-install';
  if (!('serviceWorker' in navigator)) return 'unsupported';
  if (!('PushManager' in window)) return 'unsupported';
  if (!('Notification' in window)) return 'unsupported';
  return 'supported';
}

/**
 * Returns the live subscription state for the current user.
 *   'enabled'        → active subscription exists both in browser and DB
 *   'disabled'       → supported but no active subscription
 *   'denied'         → user blocked notifications in browser settings
 *   'ios-install'    → iOS browser tab, PWA install required
 *   'unsupported'    → browser has no push API
 */
export async function getPushState() {
  const support = getPushSupport();
  if (support !== 'supported') return support;

  if (Notification.permission === 'denied') return 'denied';

  try {
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error('sw-timeout')), 5_000)),
    ]);
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return 'disabled';

    // Cross-check with DB: a stale browser sub that's not in DB shouldn't
    // count as "enabled" — we won't actually receive notifications.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 'disabled';

    const { data: row } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('endpoint', sub.endpoint)
      .maybeSingle();

    return row ? 'enabled' : 'disabled';
  } catch {
    return 'disabled';
  }
}

/**
 * Attempt to register for push notifications.
 * Returns an object: { ok: true, subscription } or { ok: false, reason }.
 * reason ∈ 'denied' | 'ios-install' | 'unsupported' | 'no-user' | 'error'
 */
export async function registerPush() {
  const support = getPushSupport();
  if (support !== 'supported') return { ok: false, reason: support };

  try {
    // Fail fast if the service worker isn't ready in 10s instead of hanging forever
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error('sw-timeout')), 10_000)),
    ]);

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'denied' };

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const { endpoint, keys } = sub.toJSON();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, reason: 'no-user' };

    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert(
        { user_id: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
        { onConflict: 'endpoint' }
      )
      .select('id');

    // Detect silent failures: upsert returns no error but no row (e.g. RLS blocked it)
    if (error || !data?.length) {
      console.error('[registerPush] upsert failed', error);
      return { ok: false, reason: 'error' };
    }

    return { ok: true, subscription: sub };
  } catch (e) {
    console.error('[registerPush]', e?.message);
    return { ok: false, reason: 'error' };
  }
}

export async function unregisterPush() {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  }
}
