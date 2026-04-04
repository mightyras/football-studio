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
        top: 46,
        right: 10,
        zIndex: 6,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        background: isPenActive ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: isPenActive ? 16 : 20,
        padding: isPenActive ? '8px' : '5px 8px',
        transition: 'padding 0.15s, background 0.15s, border-radius 0.15s',
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
        <svg width="18" height="18" viewBox="0 -960 960 960" fill="currentColor">
          <path d="M160-120v-170l527-526q12-12 27-18t30-6q16 0 30.5 6t25.5 18l56 56q12 11 18 25.5t6 30.5q0 15-6 30t-18 27L330-120H160Zm80-80h56l393-392-28-29-29-28-392 393v56Zm560-503-57-57 57 57Zm-139 82-29-28 57 57-28-29ZM560-120q74 0 137-37t63-103q0-36-19-62t-51-45l-59 59q23 10 36 22t13 26q0 23-36.5 41.5T560-200q-17 0-28.5 11.5T520-160q0 17 11.5 28.5T560-120ZM183-426l60-60q-20-8-31.5-16.5T200-520q0-12 18-24t76-37q88-38 117-69t29-70q0-55-44-87.5T280-840q-45 0-80.5 16T145-785q-11 13-9 29t15 26q13 11 29 9t27-13q14-14 31-20t42-6q41 0 60.5 12t19.5 28q0 14-17.5 25.5T262-654q-80 35-111 63.5T120-520q0 32 17 54.5t46 39.5Z" />
        </svg>
      </button>

      {/* Expanded controls — vertical stack when pen is active */}
      {isPenActive && (
        <>
          {/* Separator */}
          <div style={{
            height: 1,
            width: 18,
            background: 'rgba(255,255,255,0.15)',
          }} />

          {/* Color dots — vertical */}
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
                height: 1,
                width: 18,
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
                height: 1,
                width: 18,
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
                  justifyContent: 'center',
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: state.holdStrokesOnPause
                    ? 'rgba(245, 158, 11, 0.25)'
                    : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: state.holdStrokesOnPause
                    ? '#f59e0b'
                    : 'rgba(255,255,255,0.5)',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {state.holdStrokesOnPause ? (
                    <>
                      <rect x="6" y="11" width="12" height="11" rx="2" />
                      <path d="M12 17v-2" />
                      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </>
                  ) : (
                    <>
                      <rect x="6" y="11" width="12" height="11" rx="2" />
                      <path d="M12 17v-2" />
                      <path d="M8 11V7a4 4 0 0 1 7.83-1" />
                    </>
                  )}
                </svg>
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
