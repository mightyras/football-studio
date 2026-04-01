import { useCallback } from 'react';
import { useAnalytics } from '../AnalyticsContext';
import { formatTime } from '../utils/time';
import { THEME } from '../../constants/colors';
import type { VideoPlayerHandle } from './VideoPlayer';

type Props = {
  playerRef: React.RefObject<VideoPlayerHandle | null>;
  onScreenshot: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  clipCount: number;
  clipsOpen: boolean;
  onToggleClips: () => void;
};

export function ClipActions({ playerRef, onScreenshot, onStartRecording, onStopRecording, clipCount, clipsOpen, onToggleClips }: Props) {
  const { state, dispatch } = useAnalytics();
  const isActive = state.streamStatus === 'playing';
  const isRecording = state.recordingStatus === 'recording';
  const hasStart = state.inPoint !== null;
  const hasEnd = state.outPoint !== null;
  const hasRange = hasStart && hasEnd && state.outPoint! > state.inPoint!;
  const clipDuration = hasRange ? state.outPoint! - state.inPoint! : 0;

  const setStartPoint = useCallback(() => {
    const video = playerRef.current?.getVideoElement();
    if (!video) return;
    dispatch({ type: 'SET_IN_POINT', time: video.currentTime });
    if (state.outPoint !== null && state.outPoint <= video.currentTime) {
      dispatch({ type: 'SET_OUT_POINT', time: null });
    }
  }, [playerRef, dispatch, state.outPoint]);

  const setEndPoint = useCallback(() => {
    const video = playerRef.current?.getVideoElement();
    if (!video) return;
    if (state.inPoint !== null && video.currentTime <= state.inPoint) return;
    dispatch({ type: 'SET_OUT_POINT', time: video.currentTime });
  }, [playerRef, dispatch, state.inPoint]);

  const clearRange = useCallback(() => {
    dispatch({ type: 'SET_IN_POINT', time: null });
    dispatch({ type: 'SET_OUT_POINT', time: null });
  }, [dispatch]);

  const btnStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '5px 10px',
    background: active ? THEME.surfaceHover : 'transparent',
    border: 'none',
    borderRadius: 4,
    color: active ? THEME.secondary : THEME.textMuted,
    fontSize: 11,
    fontWeight: 500,
    fontFamily: 'inherit',
    cursor: active ? 'pointer' : 'not-allowed',
  });

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '6px 12px',
      background: THEME.surface,
      borderTop: `1px solid ${THEME.borderSubtle}`,
      opacity: isActive ? 1 : 0.5,
    }}>
      {/* ─── Screenshot ─── */}
      <button
        onClick={onScreenshot}
        disabled={!isActive}
        title="Capture Screenshot"
        style={btnStyle(isActive)}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        Screenshot
      </button>

      {/* ─── Video clip: label + Start / End / Record ─── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {/* Label */}
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          color: THEME.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '0.3px',
          marginRight: 2,
        }}>
          Video clip
        </span>

        {isRecording ? (
          <button
            onClick={onStopRecording}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              background: '#dc2626',
              border: 'none',
              borderRadius: 4,
              color: '#fff',
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            <div style={{ width: 8, height: 8, background: '#fff', borderRadius: 2 }} />
            Stop {formatTime(state.recordingElapsed)}
          </button>
        ) : (
          <>
            {/* Start */}
            <button
              onClick={setStartPoint}
              disabled={!isActive}
              title="Set start point (I)"
              style={{
                ...btnStyle(isActive),
                background: hasStart ? THEME.surfaceHover : 'transparent',
                color: hasStart ? THEME.secondary : THEME.textMuted,
                fontVariantNumeric: 'tabular-nums',
                borderRadius: '4px 0 0 4px',
              }}
            >
              <span style={{ color: '#22c55e', fontWeight: 700, fontSize: 13 }}>[</span>
              {hasStart ? formatTime(state.inPoint!) : 'Start'}
            </button>

            <span style={{ color: THEME.textMuted, fontSize: 10 }}>—</span>

            {/* End */}
            <button
              onClick={setEndPoint}
              disabled={!isActive || !hasStart}
              title="Set end point (O)"
              style={{
                ...btnStyle(isActive && hasStart),
                background: hasEnd ? THEME.surfaceHover : 'transparent',
                color: hasEnd ? THEME.secondary : THEME.textMuted,
                fontVariantNumeric: 'tabular-nums',
                borderRadius: hasRange ? 0 : '0 4px 4px 0',
              }}
            >
              {hasEnd ? formatTime(state.outPoint!) : 'End'}
              <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 13 }}>]</span>
            </button>

            {/* Record — appears when range is complete */}
            {hasRange && (
              <button
                onClick={onStartRecording}
                title={`Record ${clipDuration.toFixed(1)}s clip (R)`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 10px',
                  background: '#dc2626',
                  border: 'none',
                  borderRadius: '0 4px 4px 0',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                <div style={{ width: 7, height: 7, background: '#fff', borderRadius: '50%' }} />
                Record {clipDuration.toFixed(1)}s
              </button>
            )}

            {/* Clear */}
            {hasStart && (
              <button
                onClick={clearRange}
                title="Clear range"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '5px 6px',
                  background: 'none',
                  border: 'none',
                  color: THEME.textMuted,
                  cursor: 'pointer',
                  fontSize: 12,
                  lineHeight: 1,
                  opacity: 0.5,
                }}
              >
                &times;
              </button>
            )}
          </>
        )}
      </div>

      <div style={{ flex: 1 }} />

      {/* ─── Clips panel toggle ─── */}
      {clipCount > 0 && (
        <button
          onClick={onToggleClips}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            background: clipsOpen ? THEME.highlight : THEME.surfaceHover,
            border: `1px solid ${clipsOpen ? THEME.highlight : THEME.borderSubtle}`,
            borderRadius: 6,
            color: clipsOpen ? '#000' : THEME.secondary,
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'inherit',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          title={clipsOpen ? 'Close clips panel' : 'Open clips panel'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
            <line x1="7" y1="2" x2="7" y2="22" />
            <line x1="17" y1="2" x2="17" y2="22" />
            <line x1="2" y1="12" x2="22" y2="12" />
          </svg>
          Clips ({clipCount})
        </button>
      )}
    </div>
  );
}
