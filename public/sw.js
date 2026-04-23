// In-memory badge counter for the current service-worker lifetime. Gets reset
// whenever the SW is terminated; the app refreshes to the exact count via
// useAppBadge on next open, which corrects any drift.
let badgeCount = 0;

async function bumpBadge() {
  badgeCount += 1;
  try {
    if (typeof self.navigator?.setAppBadge === 'function') {
      await self.navigator.setAppBadge(badgeCount);
    }
  } catch {}
}

self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  const title = data.title || 'Unchain Hub';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || '/' },
    vibrate: [100, 50, 100],
  };
  event.waitUntil(Promise.all([
    self.registration.showNotification(title, options),
    bumpBadge(),
  ]));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  badgeCount = 0;
  try { self.navigator?.clearAppBadge?.(); } catch {}
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin));
      if (existing) { existing.focus(); existing.navigate(url); }
      else clients.openWindow(url);
    })
  );
});

// When any tab becomes focused, assume the user is now looking at content — the
// running app will set the precise count via useAppBadge.
self.addEventListener('message', event => {
  if (event.data?.type === 'badge-reset') {
    badgeCount = 0;
  }
});
