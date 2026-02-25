import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../state/AuthContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import { hexToRgba } from '../../utils/colorUtils';

type Method = 'email' | 'magic';

interface AuthModalProps {
  onClose: () => void;
}

export function AuthModal({ onClose }: AuthModalProps) {
  const { signInWithEmail, signInWithMagicLink } = useAuth();
  const theme = useThemeColors();
  const dialogRef = useRef<HTMLDivElement>(null);

  const [method, setMethod] = useState<Method>('email');
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
      } else {
        const { error: err } = await signInWithEmail(email, password);
        if (err) { setError(err); } else { onClose(); }
      }
    } finally {
      setBusy(false);
    }
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

        {/* Method toggle */}
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
              {busy ? '...' : method === 'magic' ? 'Send Magic Link' : 'Sign In'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
