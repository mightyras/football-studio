import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppState } from '../../state/AppStateContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import { getTotalMinutes } from '../../utils/matchComputation';
import { hexToRgba } from '../../utils/colorUtils';
import { MatchChangesDialog } from './MatchChangesDialog';

export function MatchTimeline() {
  const { state, dispatch } = useAppState();
  const theme = useThemeColors();
  const trackRef = useRef<HTMLDivElement>(null);
  const [showChangesDialog, setShowChangesDialog] = useState(false);

  const plan = state.matchPlan;
  const totalMinutes = plan ? getTotalMinutes(plan) : 90;
  const currentMinute = state.matchCurrentMinute;

  const minuteToPercent = (m: number) => (m / totalMinutes) * 100;

  const handleTrackClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!trackRef.current || !plan) return;
      const rect = trackRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      const minute = Math.round(pct * totalMinutes);
      dispatch({ type: 'SET_MATCH_MINUTE', minute });
    },
    [dispatch, plan, totalMinutes],
  );

  const handleDrag = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.buttons !== 1) return;
      handleTrackClick(e);
    },
    [handleTrackClick],
  );

  if (!plan) return null;

  // Period markers
  const periods: Array<{ minute: number; label: string }> = [
    { minute: 0, label: 'KO' },
    { minute: plan.halftimeMinute, label: 'HT' },
    { minute: 90, label: 'FT' },
  ];
  if (plan.hasExtraTime) {
    periods.push({ minute: 105, label: 'ET HT' });
    periods.push({ minute: 120, label: '120\'' });
  }

  // Substitution events for markers
  const subEvents = plan.events.filter(e => e.type === 'substitution');

  // Unique sub minutes that aren't already period markers (for quick-jump buttons)
  const periodMinutes = new Set(periods.map(p => p.minute));
  const subMinutes = [...new Set(subEvents.map(e => e.minute))]
    .filter(m => !periodMinutes.has(m))
    .sort((a, b) => a - b);

  return (
    <div
      style={{
        background: theme.surface,
        borderTop: `1px solid ${theme.border}`,
        padding: '8px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        userSelect: 'none',
      }}
    >
      {/* Timeline track */}
      <div
        ref={trackRef}
        title="Double-click to add or edit changes"
        onClick={handleTrackClick}
        onDoubleClick={(e) => {
          if (!trackRef.current || !plan) return;
          const rect = trackRef.current.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const pct = Math.max(0, Math.min(1, x / rect.width));
          const minute = Math.round(pct * totalMinutes);
          if (minute === 0) return;
          dispatch({ type: 'SET_MATCH_MINUTE', minute });
          setShowChangesDialog(true);
        }}
        onMouseMove={handleDrag}
        style={{
          position: 'relative',
          height: 32,
          background: theme.surfaceHover,
          borderRadius: 4,
          cursor: 'pointer',
          overflow: 'visible',
        }}
      >
        {/* Chip label above the track */}
        <span
          style={{
            position: 'absolute',
            left: -16,
            bottom: '100%',
            marginBottom: 0,
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: theme.textSubtle,
            lineHeight: 1,
            background: theme.surface,
            padding: '3px 6px',
            borderRadius: '4px 4px 0 0',
            pointerEvents: 'none',
          }}
        >
          Match Timeline
        </span>

        {/* Period backgrounds */}
        {plan.hasExtraTime && (
          <div
            style={{
              position: 'absolute',
              left: `${minuteToPercent(90)}%`,
              right: 0,
              top: 0,
              bottom: 0,
              background: hexToRgba(theme.highlight, 0.06),
              borderRadius: '0 4px 4px 0',
            }}
          />
        )}

        {/* Halftime marker */}
        <div
          style={{
            position: 'absolute',
            left: `${minuteToPercent(plan.halftimeMinute)}%`,
            top: 0,
            bottom: 0,
            width: 1,
            background: theme.borderSubtle,
          }}
        />

        {/* 90 min marker (if extra time) */}
        {plan.hasExtraTime && (
          <div
            style={{
              position: 'absolute',
              left: `${minuteToPercent(90)}%`,
              top: 0,
              bottom: 0,
              width: 1,
              background: theme.borderSubtle,
            }}
          />
        )}

        {/* ET halftime marker */}
        {plan.hasExtraTime && (
          <div
            style={{
              position: 'absolute',
              left: `${minuteToPercent(105)}%`,
              top: 0,
              bottom: 0,
              width: 1,
              background: theme.borderSubtle,
            }}
          />
        )}

        {/* Substitution event markers (deduplicated by minute, clickable) */}
        {[...new Set(subEvents.map(e => e.minute))].map(m => {
          const isActive = m === currentMinute;
          const size = isActive ? 12 : 8;
          return (
            <div
              key={`sub-marker-${m}`}
              title={`Click to edit changes at ${m}'`}
              onClick={(e) => {
                e.stopPropagation();
                dispatch({ type: 'SET_MATCH_MINUTE', minute: m });
                setShowChangesDialog(true);
              }}
              style={{
                position: 'absolute',
                left: `${minuteToPercent(m)}%`,
                top: 2,
                width: 20,
                height: 20,
                transform: 'translateX(-10px)',
                cursor: 'pointer',
                zIndex: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{
                width: size,
                height: size,
                borderRadius: '50%',
                background: '#22c55e',
                border: `1.5px solid ${theme.surface}`,
                transition: 'all 0.15s',
              }} />
            </div>
          );
        })}

        {/* Position change markers (deduplicated by minute, clickable) */}
        {(() => {
          const posChangeMinutes = [...new Set(
            plan.events
              .filter(e => {
                if (e.type !== 'position-change') return false;
                return !subEvents.some(s => s.playerInId === e.playerId && s.minute === e.minute);
              })
              .map(e => e.minute),
          )];
          return posChangeMinutes.map(m => {
            const isActive = m === currentMinute;
            const size = isActive ? 12 : 8;
            return (
              <div
                key={`pos-marker-${m}`}
                title={`Click to edit changes at ${m}'`}
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: 'SET_MATCH_MINUTE', minute: m });
                  setShowChangesDialog(true);
                }}
                style={{
                  position: 'absolute',
                  left: `${minuteToPercent(m)}%`,
                  top: 2,
                  width: 20,
                  height: 20,
                  transform: 'translateX(-10px)',
                  cursor: 'pointer',
                  zIndex: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div style={{
                  width: size,
                  height: size,
                  borderRadius: 2,
                  background: '#3b82f6',
                  border: `1.5px solid ${theme.surface}`,
                  transition: 'all 0.15s',
                }} />
              </div>
            );
          });
        })()}

        {/* Scrubber line */}
        <div
          style={{
            position: 'absolute',
            left: `${minuteToPercent(currentMinute)}%`,
            top: 0,
            bottom: 0,
            width: 2,
            background: theme.highlight,
            transform: 'translateX(-1px)',
            zIndex: 3,
            opacity: 0.6,
          }}
        />

        {/* Floating minute pill — replaces dot handle */}
        <div
          style={{
            position: 'absolute',
            left: `${minuteToPercent(currentMinute)}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            background: '#1a1a2e',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 10,
            whiteSpace: 'nowrap',
            zIndex: 5,
            pointerEvents: 'none',
            boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
            border: `1.5px solid ${theme.highlight}`,
          }}
        >
          {currentMinute}&prime;
        </div>
      </div>

      {/* Period labels + sub minute buttons — clickable quick-jump */}
      <div style={{ position: 'relative', height: 22, marginTop: 2 }}>
        {periods.map(p => (
          <button
            key={p.minute}
            onClick={() => dispatch({ type: 'SET_MATCH_MINUTE', minute: p.minute })}
            style={{
              position: 'absolute',
              left: `${minuteToPercent(p.minute)}%`,
              transform: 'translateX(-50%)',
              fontSize: 9,
              fontWeight: 600,
              fontFamily: 'inherit',
              color: currentMinute === p.minute ? theme.highlight : theme.textSubtle,
              background: currentMinute === p.minute
                ? hexToRgba(theme.highlight, 0.12)
                : hexToRgba(theme.textSubtle, 0.06),
              border: `1px solid ${currentMinute === p.minute ? hexToRgba(theme.highlight, 0.3) : 'transparent'}`,
              borderRadius: 8,
              padding: '1px 6px',
              cursor: 'pointer',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {p.label}
          </button>
        ))}
        {subMinutes.map(m => (
          <button
            key={`sub-${m}`}
            onClick={() => dispatch({ type: 'SET_MATCH_MINUTE', minute: m })}
            style={{
              position: 'absolute',
              left: `${minuteToPercent(m)}%`,
              transform: 'translateX(-50%)',
              fontSize: 9,
              fontWeight: 600,
              fontFamily: 'inherit',
              color: currentMinute === m ? '#22c55e' : theme.textSubtle,
              background: currentMinute === m
                ? hexToRgba('#22c55e', 0.12)
                : hexToRgba(theme.textSubtle, 0.06),
              border: `1px solid ${currentMinute === m ? hexToRgba('#22c55e', 0.3) : 'transparent'}`,
              borderRadius: 8,
              padding: '1px 6px',
              cursor: 'pointer',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {m}&prime;
          </button>
        ))}
      </div>

      {/* Changes dialog rendered via portal */}
      {showChangesDialog && createPortal(
        <MatchChangesDialog onClose={() => setShowChangesDialog(false)} />,
        document.body,
      )}
    </div>
  );
}
