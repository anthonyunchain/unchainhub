import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/api/base44Client';
import { Eye, EyeOff } from 'lucide-react';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

function loadTurnstileScript() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.turnstile) return Promise.resolve(window.turnstile);
  const existing = document.querySelector(`script[src="${TURNSTILE_SCRIPT_SRC}"]`);
  if (existing) {
    return new Promise((resolve) => {
      existing.addEventListener('load', () => resolve(window.turnstile));
    });
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = TURNSTILE_SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve(window.turnstile);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

const TRANSLATIONS = {
  en: {
    signIn: "Sign in",
    email: "Email",
    emailPlaceholder: "Email address",
    password: "Password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    signingIn: "Signing in...",
    forgotPassword: "Forgot password?",
    sendResetLink: "Send reset link",
    sending: "Sending...",
    backToSignIn: "Back to sign in",
    checkEmail: "Check your email for the reset link.",
    incorrectCredentials: "Incorrect email or password.",
  },
  fi: {
    signIn: "Kirjaudu sisään",
    email: "Sähköposti",
    emailPlaceholder: "Sähköpostiosoite",
    password: "Salasana",
    showPassword: "Näytä salasana",
    hidePassword: "Piilota salasana",
    signingIn: "Kirjaudutaan...",
    forgotPassword: "Unohtuiko salasana?",
    sendResetLink: "Lähetä palautuslinkki",
    sending: "Lähetetään...",
    backToSignIn: "Takaisin kirjautumiseen",
    checkEmail: "Tarkista sähköpostisi palautuslinkin saamiseksi.",
    incorrectCredentials: "Virheellinen sähköposti tai salasana.",
  },
};

export default function LoginPage() {
  const [email, setEmail]       = useState(() => localStorage.getItem('uc_last_email') || '');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState(() => localStorage.getItem('uc_last_email') || '');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [lang, setLang] = useState('en');
  const [captchaToken, setCaptchaToken] = useState(null);
  const turnstileContainer = useRef(null);
  const turnstileWidgetId = useRef(null);

  const tr = TRANSLATIONS[lang];

  // Mount Turnstile once whenever the visible form changes.
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    if (!turnstileContainer.current) return;
    let cancelled = false;
    loadTurnstileScript().then((turnstile) => {
      if (cancelled || !turnstile || !turnstileContainer.current) return;
      // Clean any previous widget (when user toggles between sign-in / forgot).
      if (turnstileWidgetId.current) {
        try { turnstile.remove(turnstileWidgetId.current); } catch { /* ignore */ }
        turnstileWidgetId.current = null;
      }
      turnstileWidgetId.current = turnstile.render(turnstileContainer.current, {
        sitekey: TURNSTILE_SITE_KEY,
        appearance: 'interaction-only',
        callback: (token) => setCaptchaToken(token),
        'error-callback': () => setCaptchaToken(null),
        'expired-callback': () => setCaptchaToken(null),
      });
    }).catch(() => { /* widget fails open — server still rate-limits */ });
    return () => { cancelled = true; };
  }, [showForgot]);

  const resetCaptcha = () => {
    setCaptchaToken(null);
    if (window.turnstile && turnstileWidgetId.current) {
      try { window.turnstile.reset(turnstileWidgetId.current); } catch { /* ignore */ }
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });
    if (error) {
      setError(tr.incorrectCredentials);
      setLoading(false);
      resetCaptcha();
    } else {
      localStorage.setItem('uc_last_email', email);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/`,
      captchaToken: captchaToken || undefined,
    });
    setForgotSent(true);
    setForgotLoading(false);
    resetCaptcha();
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid var(--divider)',
    fontSize: 14,
    background: 'var(--card)',
    color: 'var(--ink)',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const primaryBtnStyle = (disabled) => ({
    marginTop: 8,
    padding: '11px 0',
    borderRadius: 8,
    background: 'var(--brand)',
    color: '#fff',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontWeight: 600,
    fontSize: 14,
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.7 : 1,
    transition: 'opacity 0.2s',
  });

  const linkBtnStyle = {
    fontSize: 13,
    color: 'var(--muted)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: '16px',
      paddingTop: 'max(16px, env(safe-area-inset-top))',
      paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
      overflow: 'hidden',
    }}>
      <div style={{
        background: 'var(--card)',
        borderRadius: 20,
        padding: '36px 28px',
        width: '100%',
        maxWidth: 380,
        border: '1px solid var(--divider)',
        boxShadow: 'var(--card-shadow-hover)',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Language toggle */}
        <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 4 }}>
          {['en', 'fi'].map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              style={{
                padding: '3px 8px',
                borderRadius: 6,
                fontSize: 11,
                fontFamily: "'DM Mono', monospace",
                fontWeight: 600,
                letterSpacing: '0.05em',
                border: '1px solid var(--divider)',
                background: lang === l ? 'var(--brand)' : 'transparent',
                color: lang === l ? '#fff' : 'var(--muted)',
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              {l}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <p className="text-label-mono" style={{ marginBottom: 6 }}>
            Unchain Studio
          </p>
          <h1 className="text-h1" style={{ margin: 0 }}>
            {tr.signIn}
          </h1>
        </div>

        {showForgot ? (
          forgotSent ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: 'var(--success-text)', marginBottom: 16 }} role="status">
                {tr.checkEmail}
              </p>
              <button
                type="button"
                onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(''); }}
                style={{ ...linkBtnStyle, color: 'var(--brand)' }}
              >
                {tr.backToSignIn}
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label htmlFor="forgot-email" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                  {tr.email}
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  required
                  placeholder={tr.emailPlaceholder}
                  style={inputStyle}
                />
              </div>
              {TURNSTILE_SITE_KEY && (
                <div ref={turnstileContainer} style={{ minHeight: 0 }} />
              )}
              <button
                type="submit"
                disabled={forgotLoading || (!!TURNSTILE_SITE_KEY && !captchaToken)}
                style={primaryBtnStyle(forgotLoading || (!!TURNSTILE_SITE_KEY && !captchaToken))}
              >
                {forgotLoading ? tr.sending : tr.sendResetLink}
              </button>
              <button
                type="button"
                onClick={() => setShowForgot(false)}
                style={linkBtnStyle}
              >
                {tr.backToSignIn}
              </button>
            </form>
          )
        ) : (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }} noValidate>
            <div>
              <label htmlFor="login-email" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                {tr.email}
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder={tr.emailPlaceholder}
                aria-invalid={!!error}
                aria-describedby={error ? "login-error" : undefined}
                style={inputStyle}
              />
            </div>

            <div>
              <label htmlFor="login-password" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                {tr.password}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  aria-invalid={!!error}
                  aria-describedby={error ? "login-error" : undefined}
                  style={{ ...inputStyle, padding: '10px 40px 10px 12px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? tr.hidePassword : tr.showPassword}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    padding: 6,
                    cursor: 'pointer',
                    color: 'var(--muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 32,
                    minWidth: 32,
                  }}
                >
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
            </div>

            {error && (
              <p id="login-error" role="alert" aria-live="polite" style={{ fontSize: 13, color: 'var(--urgent-text)', margin: 0 }}>
                {error}
              </p>
            )}

            {TURNSTILE_SITE_KEY && (
              <div ref={turnstileContainer} style={{ minHeight: 0 }} />
            )}

            <button
              type="submit"
              disabled={loading || (!!TURNSTILE_SITE_KEY && !captchaToken)}
              style={primaryBtnStyle(loading || (!!TURNSTILE_SITE_KEY && !captchaToken))}
            >
              {loading ? tr.signingIn : tr.signIn}
            </button>

            <button
              type="button"
              onClick={() => setShowForgot(true)}
              style={{ ...linkBtnStyle, marginTop: 4 }}
            >
              {tr.forgotPassword}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
