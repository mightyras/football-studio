import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../state/AuthContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import { hexToRgba } from '../../utils/colorUtils';

type Tab = 'signin' | 'signup';
type Method = 'email' | 'magic';

interface AuthModalProps {
  onClose: () => void;
}

export function AuthModal({ onClose }: AuthModalProps) {
  const { signInWithEmail, signUpWithEmail, signInWithMagicLink, signInWithGoogle } = useAuth();
  const theme = useThemeColors();
  const dialogRef = useRef<HTMLDivElement>(null);

  const [tab, setTab] = useState<Tab>('signin');
  const [method, setMethod] = useState<Method>('email');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      if (method === 'magic') {
        const { error: err } = await signInWithMagicLink(email);
        if (err) { setError(err); } else { setMagicLinkSent(true); }
      } else if (tab === 'signin') {
        const { error: err } = await signInWithEmail(email, password);
        if (err) { setError(err); } else { onClose(); }
      } else {
        if (!firstName.trim() || !lastName.trim()) {
          setError('First name and last name are required');
          return;
        }
        const { error: err } = await signUpWithEmail(email, password, firstName.trim(), lastName.trim());
        if (err) { setError(err); } else { onClose(); }
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    const { error: err } = await signInWithGoogle();
    if (err) setError(err);
    // OAuth redirects, so no onClose needed
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    fontSize: 13,
    fontFamily: 'inherit',
    background: theme.inputBg,
    border: `1px solid ${theme.borderSubtle}`,
    borderRadius: 4,
    color: theme.secondary,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '8px 0',
    fontSize: 13,
    fontFamily: 'inherit',
    fontWeight: active ? 600 : 400,
    border: 'none',
    borderBottom: active ? `2px solid ${theme.highlight}` : '2px solid transparent',
    background: 'transparent',
    color: active ? theme.secondary : theme.textSubtle,
    cursor: 'pointer',
    transition: 'all 0.15s',
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onKeyDown={e => e.stopPropagation()}
      onKeyUp={e => e.stopPropagation()}
      onMouseDown={e => {
        if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        style={{
          background: theme.border,
          border: `1px solid ${theme.borderSubtle}`,
          borderRadius: 8,
          padding: '24px',
          maxWidth: 400,
          width: '90%',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
        }}
      >
        <h2 style={{
          margin: '0 0 16px',
          fontSize: 18,
          fontWeight: 700,
          color: theme.secondary,
          textAlign: 'center',
        }}>
          Football Tactics Studio
        </h2>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${theme.borderSubtle}`, marginBottom: 16 }}>
          <button style={tabStyle(tab === 'signin')} onClick={() => { setTab('signin'); setError(null); setMagicLinkSent(false); }}>
            Sign In
          </button>
          <button style={tabStyle(tab === 'signup')} onClick={() => { setTab('signup'); setMethod('email'); setError(null); setMagicLinkSent(false); }}>
            Sign Up
          </button>
        </div>

        {/* Google OAuth */}
        <button
          onClick={handleGoogle}
          disabled={busy}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '8px 16px',
            fontSize: 13,
            fontFamily: 'inherit',
            border: `1px solid ${theme.borderSubtle}`,
            borderRadius: 4,
            background: theme.inputBg,
            color: theme.secondary,
            cursor: busy ? 'wait' : 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = theme.textSubtle; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = theme.borderSubtle; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          margin: '16px 0',
          color: theme.textSubtle,
          fontSize: 11,
        }}>
          <div style={{ flex: 1, height: 1, background: theme.borderSubtle }} />
          or
          <div style={{ flex: 1, height: 1, background: theme.borderSubtle }} />
        </div>

        {/* Method toggle (signin only) */}
        {tab === 'signin' && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button
              onClick={() => { setMethod('email'); setError(null); setMagicLinkSent(false); }}
              style={{
                flex: 1,
                padding: '6px',
                fontSize: 11,
                fontFamily: 'inherit',
                border: method === 'email' ? `1px solid ${theme.highlight}` : `1px solid ${theme.borderSubtle}`,
                borderRadius: 4,
                background: method === 'email' ? hexToRgba(theme.highlight, 0.1) : 'transparent',
                color: method === 'email' ? theme.highlight : theme.textMuted,
                cursor: 'pointer',
              }}
            >
              Email & Password
            </button>
            <button
              onClick={() => { setMethod('magic'); setError(null); setMagicLinkSent(false); }}
              style={{
                flex: 1,
                padding: '6px',
                fontSize: 11,
                fontFamily: 'inherit',
                border: method === 'magic' ? `1px solid ${theme.highlight}` : `1px solid ${theme.borderSubtle}`,
                borderRadius: 4,
                background: method === 'magic' ? hexToRgba(theme.highlight, 0.1) : 'transparent',
                color: method === 'magic' ? theme.highlight : theme.textMuted,
                cursor: 'pointer',
              }}
            >
              Magic Link
            </button>
          </div>
        )}

        {/* Magic link sent confirmation */}
        {magicLinkSent ? (
          <div style={{
            padding: '12px 16px',
            background: hexToRgba(theme.highlight, 0.1),
            border: `1px solid ${hexToRgba(theme.highlight, 0.3)}`,
            borderRadius: 6,
            color: theme.secondary,
            fontSize: 13,
            lineHeight: 1.5,
            textAlign: 'center',
          }}>
            Check your email for a login link.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {tab === 'signup' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="First name"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    required
                    style={{ ...inputStyle, width: undefined, flex: 1 }}
                    onFocus={e => { e.currentTarget.style.borderColor = theme.highlight; }}
                    onBlur={e => { e.currentTarget.style.borderColor = theme.borderSubtle; }}
                  />
                  <input
                    type="text"
                    placeholder="Last name"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    required
                    style={{ ...inputStyle, width: undefined, flex: 1 }}
                    onFocus={e => { e.currentTarget.style.borderColor = theme.highlight; }}
                    onBlur={e => { e.currentTarget.style.borderColor = theme.borderSubtle; }}
                  />
                </div>
              )}
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = theme.highlight; }}
                onBlur={e => { e.currentTarget.style.borderColor = theme.borderSubtle; }}
              />
              {method === 'email' && (
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = theme.highlight; }}
                  onBlur={e => { e.currentTarget.style.borderColor = theme.borderSubtle; }}
                />
              )}
            </div>

            {error && (
              <div style={{
                marginTop: 10,
                padding: '6px 10px',
                fontSize: 12,
                color: '#f87171',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: 4,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              style={{
                width: '100%',
                marginTop: 14,
                padding: '9px 16px',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'inherit',
                border: `1px solid ${theme.highlight}`,
                borderRadius: 4,
                background: hexToRgba(theme.highlight, 0.15),
                color: theme.highlight,
                cursor: busy ? 'wait' : 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = hexToRgba(theme.highlight, 0.3); }}
              onMouseLeave={e => { e.currentTarget.style.background = hexToRgba(theme.highlight, 0.15); }}
            >
              {busy ? '...' : method === 'magic' ? 'Send Magic Link' : tab === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
