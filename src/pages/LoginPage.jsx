import { useState } from 'react';
import { supabase } from '@/api/base44Client';

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message || 'Incorrect email or password.');
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: 'https://unchainhub.vercel.app',
    });
    setForgotSent(true);
    setForgotLoading(false);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#EEF0F5',
      padding: '16px',
      paddingTop: 'max(16px, env(safe-area-inset-top))',
      paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
      overflow: 'hidden',
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: 20,
        padding: '36px 28px',
        width: '100%',
        maxWidth: 380,
        border: '1px solid #e0e0e0',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <p style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 11,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#888',
            marginBottom: 6,
          }}>
            Unchain Studio
          </p>
          <h1 style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 22,
            fontWeight: 700,
            color: '#0f0f0f',
            letterSpacing: '-0.5px',
            margin: 0,
          }}>
            Sign in
          </h1>
        </div>

        {showForgot ? (
          forgotSent ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: '#22c55e', marginBottom: 16 }}>
                Check your email for the reset link.
              </p>
              <button
                onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(''); }}
                style={{ fontSize: 13, color: '#2A69FF', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#555', display: 'block', marginBottom: 6 }}>
                  Email
                </label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  required
                  placeholder="Email address"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid #e0e0e0',
                    fontSize: 14,
                    background: '#ffffff',
                    color: '#0f0f0f',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={forgotLoading}
                style={{
                  marginTop: 8,
                  padding: '11px 0',
                  borderRadius: 8,
                  background: '#2A69FF',
                  color: '#fff',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontWeight: 600,
                  fontSize: 14,
                  border: 'none',
                  cursor: forgotLoading ? 'not-allowed' : 'pointer',
                  opacity: forgotLoading ? 0.7 : 1,
                }}
              >
                {forgotLoading ? 'Sending...' : 'Send reset link'}
              </button>
              <button
                type="button"
                onClick={() => setShowForgot(false)}
                style={{ fontSize: 13, color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Back to sign in
              </button>
            </form>
          )
        ) : (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#555', display: 'block', marginBottom: 6 }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="Email address"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #e0e0e0',
                  fontSize: 14,
                  background: '#ffffff',
                  color: '#0f0f0f',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#555', display: 'block', marginBottom: 6 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    padding: '10px 40px 10px 12px',
                    borderRadius: 8,
                    border: '1px solid #e0e0e0',
                    fontSize: 14,
                    background: '#ffffff',
                    color: '#0f0f0f',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    padding: 6,
                    cursor: 'pointer',
                    color: '#888',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <line x1="2" y1="2" x2="22" y2="22" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p style={{ fontSize: 13, color: '#e53e3e', margin: 0 }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 8,
                padding: '11px 0',
                borderRadius: 8,
                background: '#2A69FF',
                color: '#fff',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 600,
                fontSize: 14,
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>

            <button
              type="button"
              onClick={() => setShowForgot(true)}
              style={{ fontSize: 13, color: '#888', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4 }}
            >
              Forgot password?
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
