import { useState, useEffect, useCallback } from 'react';
import { THEME } from '../../constants/colors';
import { PRESET_COMPETITIONS } from '../types';

type Props = {
  currentValue: string | null;
  onSelect: (competition: string) => void;
  onClear: () => void;
  onDismiss: () => void;
};

export function CompetitionPicker({ currentValue, onSelect, onClear, onDismiss }: Props) {
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const isCustom = currentValue !== null && !PRESET_COMPETITIONS.includes(currentValue as typeof PRESET_COMPETITIONS[number]);

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (customMode) {
        setCustomMode(false);
      } else {
        onDismiss();
      }
      e.stopPropagation();
      e.preventDefault();
    }
  }, [customMode, onDismiss]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [handleKey]);

  const handleCustomSubmit = () => {
    const trimmed = customValue.trim();
    if (trimmed) {
      onSelect(trimmed);
    }
  };

  return (
    <>
    {/* Transparent click-outside overlay */}
    <div
      onClick={onDismiss}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 5000,
      }}
    />
    {/* Panel positioned below header */}
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        marginTop: 6,
        zIndex: 5001,
        background: 'rgba(10, 10, 10, 0.95)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 10,
          padding: '8px 0',
          width: 220,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
        }}
      >
        <div style={{
          padding: '4px 14px 8px',
          fontSize: 10,
          fontWeight: 600,
          color: THEME.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          Competition
        </div>

        {customMode ? (
          <div style={{ padding: '4px 10px 8px' }}>
            <input
              autoFocus
              type="text"
              value={customValue}
              placeholder="Enter competition name..."
              onChange={e => setCustomValue(e.target.value)}
              onKeyDown={e => {
                e.stopPropagation();
                if (e.key === 'Enter') handleCustomSubmit();
              }}
              style={{
                width: '100%',
                padding: '6px 8px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: `1px solid ${THEME.highlight}`,
                borderRadius: 5,
                color: '#fff',
                fontSize: 13,
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button
                onClick={() => setCustomMode(false)}
                style={{
                  flex: 1,
                  padding: '5px 0',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 5,
                  color: THEME.textMuted,
                  fontSize: 12,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                Back
              </button>
              <button
                onClick={handleCustomSubmit}
                style={{
                  flex: 1,
                  padding: '5px 0',
                  background: THEME.highlight,
                  border: 'none',
                  borderRadius: 5,
                  color: '#000',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Current custom value shown at top if it's not a preset */}
            {isCustom && currentValue && (
              <button
                onClick={() => {}} // Already selected
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '7px 14px',
                  background: 'none',
                  border: 'none',
                  cursor: 'default',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  color: THEME.secondary,
                  textAlign: 'left',
                }}
              >
                <span style={{ flex: 1, fontStyle: 'italic' }}>{currentValue}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={THEME.highlight} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>
            )}

            {PRESET_COMPETITIONS.map(comp => {
              const isSelected = currentValue === comp;
              return (
                <button
                  key={comp}
                  onClick={() => onSelect(comp)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '7px 14px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    color: THEME.secondary,
                    textAlign: 'left',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = THEME.surfaceHover; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                >
                  <span style={{ flex: 1 }}>{comp}</span>
                  {isSelected && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={THEME.highlight} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}

            {/* Divider */}
            <div style={{ height: 1, background: 'rgba(255, 255, 255, 0.08)', margin: '4px 0' }} />

            {/* Custom option */}
            <button
              onClick={() => {
                setCustomValue(isCustom && currentValue ? currentValue : '');
                setCustomMode(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '7px 14px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontFamily: 'inherit',
                color: THEME.textMuted,
                textAlign: 'left',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = THEME.surfaceHover; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
            >
              <span style={{ flex: 1 }}>Custom...</span>
            </button>

            {/* Clear option (only if something is selected) */}
            {currentValue && (
              <button
                onClick={onClear}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '7px 14px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  color: 'rgba(239, 68, 68, 0.8)',
                  textAlign: 'left',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = THEME.surfaceHover; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
              >
                <span style={{ flex: 1 }}>Clear</span>
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}
