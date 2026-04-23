import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { registerPush, getPushState } from '@/lib/pushNotifications';

const STORAGE_KEY = 'push_prompt_seen_at';
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // re-prompt after a week

const COPY = {
  en: {
    title: 'Turn on notifications',
    body: 'Get a push when a message, shooting, or task needs your attention — even when the app is closed.',
    enable: 'Enable',
    later: 'Not now',
  },
  fr: {
    title: 'Activer les notifications',
    body: 'Recevez une alerte dès qu\u2019un message, un shooting ou une tâche arrive — même app fermée.',
    enable: 'Activer',
    later: 'Plus tard',
  },
  fi: {
    title: 'Ota ilmoitukset käyttöön',
    body: 'Saat ilmoituksen viesteistä, kuvauksista ja tehtävistä \u2014 vaikka sovellus olisi kiinni.',
    enable: 'Ota käyttöön',
    later: 'Myöhemmin',
  },
};

function resolveLocale() {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem('cp_lang') || localStorage.getItem('app_lang');
  if (stored && COPY[stored]) return stored;
  const nav = (navigator.language || 'en').slice(0, 2);
  return COPY[nav] ? nav : 'en';
}

export default function PushEnableModal() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locale] = useState(resolveLocale);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === 'undefined') return;
      // Only prompt when the browser has never been asked.
      if (!('Notification' in window)) return;
      if (Notification.permission !== 'default') return;

      const seenAt = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
      if (seenAt && Date.now() - seenAt < COOLDOWN_MS) return;

      const state = await getPushState();
      if (cancelled) return;
      // 'disabled' is the only state where a prompt makes sense.
      if (state !== 'disabled') return;

      setOpen(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setOpen(false);
  };

  const handleEnable = async () => {
    setBusy(true);
    try {
      await registerPush();
    } finally {
      setBusy(false);
      dismiss();
    }
  };

  if (!open) return null;
  const t = COPY[locale] || COPY.en;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="push-enable-title"
      onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div style={{
        background: 'var(--card)',
        borderRadius: 'var(--card-radius, 20px)',
        boxShadow: 'var(--card-shadow-hover)',
        width: '100%', maxWidth: 380,
        padding: 24,
        position: 'relative',
      }}>
        <button
          onClick={dismiss}
          aria-label="Close"
          style={{
            position: 'absolute', top: 12, right: 12,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--muted)', display: 'flex',
            padding: 6, borderRadius: 8,
          }}
        >
          <X style={{ width: 16, height: 16 }} />
        </button>

        <div style={{
          width: 52, height: 52, borderRadius: 16,
          background: 'var(--brand-muted, rgba(42,105,255,0.12))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 14,
        }}>
          <Bell style={{ width: 24, height: 24, color: 'var(--brand)' }} />
        </div>

        <h2 id="push-enable-title" style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: 18, fontWeight: 700, color: 'var(--ink)',
          margin: '0 0 8px',
        }}>{t.title}</h2>

        <p style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: 13, lineHeight: 1.5, color: 'var(--muted)',
          margin: '0 0 20px',
        }}>{t.body}</p>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={dismiss}
            disabled={busy}
            style={{
              flex: 1, padding: '11px 14px', borderRadius: 12,
              background: 'transparent',
              border: '1px solid var(--divider)',
              cursor: busy ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 600,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              color: 'var(--ink)',
            }}
          >{t.later}</button>
          <button
            onClick={handleEnable}
            disabled={busy}
            style={{
              flex: 1, padding: '11px 14px', borderRadius: 12,
              background: 'var(--brand)',
              border: 'none', color: '#fff',
              cursor: busy ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 700,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              opacity: busy ? 0.7 : 1,
            }}
          >{t.enable}</button>
        </div>
      </div>
    </div>
  );
}
