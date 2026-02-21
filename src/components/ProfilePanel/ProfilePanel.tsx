import { useState } from 'react';
import { useAuth } from '../../state/AuthContext';
import { useThemeColors } from '../../hooks/useThemeColors';

interface ProfilePanelProps {
  onClose: () => void;
}

export function ProfilePanel({ onClose }: ProfilePanelProps) {
  const { profile, updateProfile, updateEmail } = useAuth();
  const theme = useThemeColors();

  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [email, setEmail] = useState(profile?.email || '');
  const [editingEmail, setEditingEmail] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  if (!profile) return null;

  const initials = profile.display_name
    ? profile.display_name.trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase()
    : profile.email[0].toUpperCase();

  const smallLabelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: theme.textMuted,
    marginBottom: 6,
    display: 'block',
  };

  async function handleSaveName() {
    const trimmed = displayName.trim();
    if (!trimmed || trimmed === profile!.display_name) {
      setDisplayName(profile!.display_name || '');
      setEditingName(false);
      setNameError(null);
      return;
    }
    setSavingName(true);
    setNameError(null);
    const { error } = await updateProfile({ display_name: trimmed });
    if (error) {
      setNameError(error);
    } else {
      setEditingName(false);
    }
    setSavingName(false);
  }

  async function handleSaveEmail() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || trimmed === profile!.email) {
      setEmail(profile!.email);
      setEditingEmail(false);
      setEmailError(null);
      return;
    }
    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    setSavingEmail(true);
    setEmailError(null);
    setEmailSent(false);
    const { error } = await updateEmail(trimmed);
    if (error) {
      setEmailError(error);
    } else {
      setEmailSent(true);
      setEditingEmail(false);
    }
    setSavingEmail(false);
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2100,
      }}
      onKeyDown={e => e.stopPropagation()}
      onKeyUp={e => e.stopPropagation()}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: theme.surface,
          border: `1px solid ${theme.borderSubtle}`,
          borderRadius: 8,
          width: '90%',
          maxWidth: 400,
          maxHeight: '85vh',
          overflow: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '16px 20px',
            borderBottom: `1px solid ${theme.border}`,
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: theme.textSubtle,
              cursor: 'pointer',
              fontSize: 18,
              padding: 0,
              lineHeight: 1,
              fontFamily: 'inherit',
            }}
            title="Close"
          >
            &#x2039;
          </button>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: theme.secondary }}>
            Account Settings
          </h3>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Avatar (read-only) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: profile.avatar_url ? 'transparent' : theme.borderSubtle,
                color: '#fff',
                fontSize: 20,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                initials
              )}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: theme.secondary }}>
                {profile.display_name || profile.email.split('@')[0]}
              </div>
              <div style={{ fontSize: 11, color: theme.textSubtle, marginTop: 2 }}>
                {profile.email}
              </div>
            </div>
          </div>

          {/* Display Name */}
          <div>
            <span style={smallLabelStyle}>Display Name</span>
            {editingName ? (
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={e => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') {
                    setDisplayName(profile.display_name || '');
                    setEditingName(false);
                    setNameError(null);
                  }
                }}
                autoFocus
                maxLength={60}
                style={{
                  width: '100%',
                  fontSize: 14,
                  fontWeight: 600,
                  color: theme.secondary,
                  background: theme.inputBg,
                  border: `1px solid ${theme.highlight}`,
                  borderRadius: 4,
                  padding: '7px 10px',
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            ) : (
              <div
                onClick={() => { setEditingName(true); setNameError(null); }}
                title="Click to edit"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  background: theme.inputBg,
                  border: `1px solid ${theme.borderSubtle}`,
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = theme.textSubtle; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = theme.borderSubtle; }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: savingName ? theme.textMuted : theme.secondary }}>
                  {savingName ? 'Saving\u2026' : displayName || profile.email.split('@')[0]}
                </span>
                <span style={{ fontSize: 10, color: theme.textSubtle }}>edit</span>
              </div>
            )}
            {nameError && (
              <div style={{
                marginTop: 6,
                padding: '6px 10px',
                fontSize: 11,
                background: theme.inputBg,
                border: '1px solid #ef4444',
                borderRadius: 4,
                color: '#ef4444',
              }}>
                {nameError}
              </div>
            )}
          </div>

          {/* Email */}
          <div>
            <span style={smallLabelStyle}>Email Address</span>
            {editingEmail ? (
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onBlur={handleSaveEmail}
                onKeyDown={e => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') {
                    setEmail(profile.email);
                    setEditingEmail(false);
                    setEmailError(null);
                  }
                }}
                autoFocus
                style={{
                  width: '100%',
                  fontSize: 14,
                  fontWeight: 600,
                  color: theme.secondary,
                  background: theme.inputBg,
                  border: `1px solid ${theme.highlight}`,
                  borderRadius: 4,
                  padding: '7px 10px',
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            ) : (
              <div
                onClick={() => { setEditingEmail(true); setEmailError(null); setEmailSent(false); }}
                title="Click to edit"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  background: theme.inputBg,
                  border: `1px solid ${theme.borderSubtle}`,
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = theme.textSubtle; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = theme.borderSubtle; }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: savingEmail ? theme.textMuted : theme.secondary }}>
                  {savingEmail ? 'Saving\u2026' : email}
                </span>
                <span style={{ fontSize: 10, color: theme.textSubtle }}>edit</span>
              </div>
            )}
            {emailSent && (
              <div style={{
                marginTop: 6,
                padding: '8px 10px',
                fontSize: 11,
                background: theme.inputBg,
                border: `1px solid ${theme.highlight}`,
                borderRadius: 4,
                color: theme.secondary,
                lineHeight: 1.5,
              }}>
                A confirmation link has been sent to your new email address.
                Your email will update after you click the link.
              </div>
            )}
            {emailError && (
              <div style={{
                marginTop: 6,
                padding: '6px 10px',
                fontSize: 11,
                background: theme.inputBg,
                border: '1px solid #ef4444',
                borderRadius: 4,
                color: '#ef4444',
              }}>
                {emailError}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
