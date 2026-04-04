import { useState, useEffect, useCallback, useRef } from 'react';
import { THEME } from '../../constants/colors';

type Props = {
  homeTeamName: string | null;
  awayTeamName: string | null;
  onConfirm: (homeScore: number, awayScore: number) => void;
  onDismiss: () => void;
};

export function GoalTeamPicker({ homeTeamName, awayTeamName, onConfirm, onDismiss }: Props) {
  const home = homeTeamName || 'Home';
  const away = awayTeamName || 'Away';

  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const homeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    homeRef.current?.focus();
    homeRef.current?.select();
  }, []);

  const handleSubmit = useCallback(() => {
    onConfirm(homeScore, awayScore);
  }, [homeScore, awayScore, onConfirm]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onDismiss();
    }
    if (e.key === 'Enter') {
      e.stopPropagation();
      handleSubmit();
    }
  }, [onDismiss, handleSubmit]);

  return (
    <div
      onClick={onDismiss}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 5000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.4)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={{
          background: 'rgba(10, 10, 10, 0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 10,
          padding: '12px 16px',
          width: 280,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
        }}
      >
        <div style={{
          fontSize: 10,
          fontWeight: 600,
          color: THEME.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: 12,
          textAlign: 'center',
        }}>
          Set score
        </div>

        {/* Score inputs row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
          {/* Home team */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.7)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '100%',
            }}>
              {home}
            </span>
            <input
              ref={homeRef}
              type="number"
              min={0}
              max={99}
              value={homeScore}
              onChange={e => setHomeScore(Math.max(0, parseInt(e.target.value) || 0))}
              style={{
                width: 48,
                padding: '6px 4px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: 6,
                color: '#ffffff',
                fontSize: 20,
                fontWeight: 700,
                fontFamily: "'Courier New', Courier, monospace",
                textAlign: 'center',
                outline: 'none',
              }}
              onFocus={e => {
                e.target.style.borderColor = THEME.highlight;
                e.target.select();
              }}
              onBlur={e => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)'; }}
            />
          </div>

          <span style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'rgba(255, 255, 255, 0.4)',
            paddingTop: 18,
          }}>
            -
          </span>

          {/* Away team */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.7)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '100%',
            }}>
              {away}
            </span>
            <input
              type="number"
              min={0}
              max={99}
              value={awayScore}
              onChange={e => setAwayScore(Math.max(0, parseInt(e.target.value) || 0))}
              style={{
                width: 48,
                padding: '6px 4px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: 6,
                color: '#ffffff',
                fontSize: 20,
                fontWeight: 700,
                fontFamily: "'Courier New', Courier, monospace",
                textAlign: 'center',
                outline: 'none',
              }}
              onFocus={e => {
                e.target.style.borderColor = THEME.highlight;
                e.target.select();
              }}
              onBlur={e => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)'; }}
            />
          </div>
        </div>

        {/* Confirm button */}
        <button
          onClick={handleSubmit}
          style={{
            width: '100%',
            marginTop: 12,
            padding: '7px 0',
            background: THEME.highlight,
            border: 'none',
            borderRadius: 6,
            color: '#000',
            fontSize: 12,
            fontWeight: 700,
            fontFamily: 'inherit',
            cursor: 'pointer',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
        >
          Confirm
        </button>

        <div style={{
          padding: '6px 0 0',
          fontSize: 9,
          color: 'rgba(255, 255, 255, 0.3)',
          textAlign: 'center',
        }}>
          Enter to confirm &middot; ESC to cancel
        </div>
      </div>
    </div>
  );
}
