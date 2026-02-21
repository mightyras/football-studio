import { useRef } from 'react';
import { useAppState } from '../../state/AppStateContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import { CollapsibleSection } from './CollapsibleSection';
import { resizeAndCompressImage } from '../../utils/imageUpload';

export function ClubIdentitySection() {
  const { state, dispatch } = useAppState();
  const theme = useThemeColors();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { clubIdentity } = state;

  const smallLabelStyle: React.CSSProperties = {
    fontSize: 11,
    color: theme.textMuted,
    marginBottom: 4,
    display: 'block',
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeAndCompressImage(file);
      dispatch({ type: 'SET_CLUB_IDENTITY', identity: { logoDataUrl: dataUrl } });
    } catch {
      // Silently ignore — file too large or invalid
    }
    e.target.value = '';
  };

  const handleRemoveLogo = () => {
    dispatch({ type: 'SET_CLUB_IDENTITY', identity: { logoDataUrl: null } });
  };

  const preview = clubIdentity.logoDataUrl ? (
    <img
      src={clubIdentity.logoDataUrl}
      alt=""
      style={{ width: 12, height: 12, objectFit: 'contain', borderRadius: 2 }}
    />
  ) : undefined;

  return (
    <CollapsibleSection label="Logo" preview={preview}>
      {/* Logo upload */}
      <span style={smallLabelStyle}>Club / Team Logo</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        {clubIdentity.logoDataUrl ? (
          <>
            <img
              src={clubIdentity.logoDataUrl}
              alt="Club logo"
              style={{
                width: 48,
                height: 48,
                objectFit: 'contain',
                borderRadius: 4,
                border: `1px solid ${theme.border}`,
                background: theme.inputBg,
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  fontSize: 10,
                  fontFamily: 'inherit',
                  padding: '3px 8px',
                  border: `1px solid ${theme.borderSubtle}`,
                  borderRadius: 3,
                  background: 'transparent',
                  color: theme.textMuted,
                  cursor: 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = theme.textSubtle; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = theme.borderSubtle; }}
              >
                Change
              </button>
              <button
                onClick={handleRemoveLogo}
                style={{
                  fontSize: 10,
                  fontFamily: 'inherit',
                  padding: '3px 8px',
                  border: `1px solid ${theme.borderSubtle}`,
                  borderRadius: 3,
                  background: 'transparent',
                  color: '#ef4444',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = theme.borderSubtle; }}
              >
                Remove
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: 48,
              height: 48,
              border: `1px dashed ${theme.borderSubtle}`,
              borderRadius: 4,
              background: 'transparent',
              color: theme.textSubtle,
              cursor: 'pointer',
              fontSize: 18,
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = theme.textSubtle;
              e.currentTarget.style.color = theme.textMuted;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = theme.borderSubtle;
              e.currentTarget.style.color = theme.textSubtle;
            }}
            title="Upload club logo"
          >
            +
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>
    </CollapsibleSection>
  );
}
