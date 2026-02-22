import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useThemeColors } from '../../hooks/useThemeColors';
import { hexToRgba } from '../../utils/colorUtils';

interface SetPasswordModalProps {
  onClose: () => void;
}

export function SetPasswordModal({ onClose }: SetPasswordModalProps) {
  const theme = useThemeColors();
  const dialogRef = useRef<HTMLDivElement>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Pre-fill display name from user metadata if available
    if (!supabase) return;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.user_metadata?.full_name) {
        setDisplayName(user.user_metadata.full_name);
      }
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      if (!supabase) throw new Error('Supabase not configured');

      // Set the password
      const { error: pwErr } = await supabase.auth.updateUser({ password });
      if (pwErr) {
        setError(pwErr.message);
        return;
      }

      // Update display name if provided
      if (displayName.trim()) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('profiles')
            .update({
              display_name: displayName.trim(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);

          // Also update auth metadata
          await supabase.auth.updateUser({
            data: { full_name: displayName.trim(), display_name: displayName.trim() },
          });
        }
      }

      setDone(true);
      setTimeout(onClose, 1500);
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
          margin: '0 0 4px',
          fontSize: 18,
          fontWeight: 700,
          color: theme.secondary,
          textAlign: 'center',
        }}>
          Welcome!
        </h2>
        <p style={{
          margin: '0 0 20px',
          fontSize: 12,
          color: theme.textMuted,
          textAlign: 'center',
        }}>
          Set up your account to get started
        </p>

        {done ? (
          <div style={{
            padding: '12px 16px',
            background: hexToRgba('#4ade80', 0.1),
            border: '1px solid rgba(74, 222, 128, 0.3)',
            borderRadius: 6,
            color: '#4ade80',
            fontSize: 13,
            fontWeight: 600,
            textAlign: 'center',
          }}>
            Account set up! Redirecting...
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                type="text"
                placeholder="Display name"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = theme.highlight; }}
                onBlur={e => { e.currentTarget.style.borderColor = theme.borderSubtle; }}
              />
              <input
                type="password"
                placeholder="Choose a password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = theme.highlight; }}
                onBlur={e => { e.currentTarget.style.borderColor = theme.borderSubtle; }}
              />
              <input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = theme.highlight; }}
                onBlur={e => { e.currentTarget.style.borderColor = theme.borderSubtle; }}
              />
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
              {busy ? 'Setting up...' : 'Complete Setup'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
