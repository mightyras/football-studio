import { useAnalytics } from '../AnalyticsContext';
import { THEME } from '../../constants/colors';

const PEN_COLORS = [
  '#ff3333', // bright red
  '#00bbff', // electric blue
  '#00ff88', // neon green
  '#ffdd00', // vivid yellow
  '#ffffff', // white
  '#ff44ff', // hot pink
];

/** Compact floating toolbar for the pen drawing tool */
export function DrawingToolbar() {
  const { state, dispatch } = useAnalytics();
  const isPenActive = state.activeTool === 'freehand';
  const hasFreehandStrokes = state.annotations.some(a => a.type === 'freehand');
  const isPaused = !state.isPlaying && state.streamStatus === 'playing';

  const togglePen = () => {
    dispatch({
      type: 'SET_ACTIVE_TOOL',
      tool: isPenActive ? 'select' : 'freehand',
    });
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderRadius: 20,
        padding: isPenActive ? '5px 10px' : '5px 8px',
        transition: 'padding 0.15s, background 0.15s',
        userSelect: 'none',
      }}
    >
      {/* Pen toggle button */}
      <button
        onClick={togglePen}
        title={isPenActive ? 'Stop drawing (D)' : 'Draw on video (D)'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: isPenActive ? THEME.highlight : 'transparent',
          border: 'none',
          color: isPenActive ? '#000' : 'rgba(255,255,255,0.7)',
          cursor: 'pointer',
          padding: 0,
          transition: 'background 0.15s, color 0.15s',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19l7-7 3 3-7 7-3-3z" />
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
          <path d="M2 2l7.586 7.586" />
          <circle cx="11" cy="11" r="2" />
        </svg>
      </button>

      {/* Expanded controls — only when pen is active */}
      {isPenActive && (
        <>
          {/* Separator */}
          <div style={{
            width: 1,
            height: 18,
            background: 'rgba(255,255,255,0.15)',
          }} />

          {/* Color dots */}
          {PEN_COLORS.map(color => {
            const isSelected = state.activeColor === color;
            return (
              <button
                key={color}
                onClick={() => dispatch({ type: 'SET_ACTIVE_COLOR', color })}
                title={color}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: color,
                  border: isSelected
                    ? `2px solid ${THEME.highlight}`
                    : '2px solid transparent',
                  outline: isSelected ? '1px solid rgba(0,0,0,0.3)' : 'none',
                  cursor: 'pointer',
                  padding: 0,
                  boxShadow: color === '#ffffff' ? 'inset 0 0 0 1px rgba(0,0,0,0.2)' : 'none',
                  transition: 'border-color 0.1s',
                  flexShrink: 0,
                }}
              />
            );
          })}

          {/* Clear button — only when strokes exist */}
          {hasFreehandStrokes && (
            <>
              <div style={{
                width: 1,
                height: 18,
                background: 'rgba(255,255,255,0.15)',
              }} />
              <button
                onClick={() => dispatch({ type: 'CLEAR_FREEHAND_ANNOTATIONS' })}
                title="Clear drawings"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: 'rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </>
          )}

          {/* Hold toggle — only when paused */}
          {isPaused && (
            <>
              <div style={{
                width: 1,
                height: 18,
                background: 'rgba(255,255,255,0.15)',
              }} />
              <button
                onClick={() => dispatch({
                  type: 'SET_HOLD_STROKES_ON_PAUSE',
                  hold: !state.holdStrokesOnPause,
                })}
                title={state.holdStrokesOnPause ? 'Strokes held (click to auto-fade)' : 'Strokes fading (click to hold)'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 8px',
                  borderRadius: 12,
                  background: state.holdStrokesOnPause
                    ? 'rgba(245, 158, 11, 0.25)'
                    : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: state.holdStrokesOnPause
                    ? '#f59e0b'
                    : 'rgba(255,255,255,0.5)',
                  fontSize: 10,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {state.holdStrokesOnPause ? (
                    // Pin/lock icon
                    <>
                      <rect x="6" y="11" width="12" height="11" rx="2" />
                      <path d="M12 17v-2" />
                      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </>
                  ) : (
                    // Unlock icon
                    <>
                      <rect x="6" y="11" width="12" height="11" rx="2" />
                      <path d="M12 17v-2" />
                      <path d="M8 11V7a4 4 0 0 1 7.83-1" />
                    </>
                  )}
                </svg>
                Hold
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
