import { useRef } from 'react';
import { useAppState } from '../../state/AppStateContext';
import { CollapsibleSection } from './CollapsibleSection';
import { ColorSwatchPicker } from './ColorSwatchPicker';
import { resizeAndCompressImage } from '../../utils/imageUpload';
import { THEME } from '../../constants/colors';

const smallLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#94a3b8',
  marginBottom: 4,
  display: 'block',
};

export function ClubIdentitySection() {
  const { state, dispatch } = useAppState();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { clubIdentity } = state;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeAndCompressImage(file);
      dispatch({ type: 'SET_CLUB_IDENTITY', identity: { logoDataUrl: dataUrl } });
    } catch {
      // Silently ignore — file too large or invalid
    }
    // Reset so the same file can be re-selected
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
  ) : clubIdentity.primaryColor ? (
    <span
      style={{
        display: 'inline-block',
        width: 12,
        height: 12,
        borderRadius: 3,
        background: clubIdentity.primaryColor,
        border: '1px solid transparent',
      }}
    />
  ) : undefined;

  return (
    <CollapsibleSection label="Club Identity" preview={preview}>
      {/* Logo upload */}
      <span style={smallLabelStyle}>Logo</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
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
                border: '1px solid #1e293b',
                background: '#0f172a',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  fontSize: 10,
                  fontFamily: 'inherit',
                  padding: '3px 8px',
                  border: '1px solid #374151',
                  borderRadius: 3,
                  background: 'transparent',
                  color: '#94a3b8',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#64748b'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#374151'; }}
              >
                Change
              </button>
              <button
                onClick={handleRemoveLogo}
                style={{
                  fontSize: 10,
                  fontFamily: 'inherit',
                  padding: '3px 8px',
                  border: '1px solid #374151',
                  borderRadius: 3,
                  background: 'transparent',
                  color: '#ef4444',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#374151'; }}
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
              border: '1px dashed #374151',
              borderRadius: 4,
              background: 'transparent',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: 18,
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#64748b';
              e.currentTarget.style.color = '#94a3b8';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#374151';
              e.currentTarget.style.color = '#64748b';
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

      {/* Primary Color */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ ...smallLabelStyle, marginBottom: 0 }}>Primary Color</span>
        {clubIdentity.primaryColor && (
          <button
            onClick={() => dispatch({ type: 'SET_CLUB_IDENTITY', identity: { primaryColor: null } })}
            style={{
              fontSize: 9,
              fontFamily: 'inherit',
              padding: '1px 6px',
              border: 'none',
              background: 'transparent',
              color: '#64748b',
              cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#94a3b8'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; }}
          >
            Reset
          </button>
        )}
      </div>
      <div style={{ marginBottom: 8 }}>
        <ColorSwatchPicker
          value={clubIdentity.primaryColor || THEME.accent}
          onChange={color => dispatch({ type: 'SET_CLUB_IDENTITY', identity: { primaryColor: color } })}
        />
      </div>

      {/* Secondary Color */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ ...smallLabelStyle, marginBottom: 0 }}>Secondary Color</span>
        {clubIdentity.secondaryColor && (
          <button
            onClick={() => dispatch({ type: 'SET_CLUB_IDENTITY', identity: { secondaryColor: null } })}
            style={{
              fontSize: 9,
              fontFamily: 'inherit',
              padding: '1px 6px',
              border: 'none',
              background: 'transparent',
              color: '#64748b',
              cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#94a3b8'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; }}
          >
            Reset
          </button>
        )}
      </div>
      <div>
        <ColorSwatchPicker
          value={clubIdentity.secondaryColor || THEME.accentHover}
          onChange={color => dispatch({ type: 'SET_CLUB_IDENTITY', identity: { secondaryColor: color } })}
        />
      </div>
    </CollapsibleSection>
  );
}
