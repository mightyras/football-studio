import { useCallback } from 'react';
import { useAnalytics } from '../AnalyticsContext';
import { formatTime } from '../utils/time';
import { THEME } from '../../constants/colors';
import type { VideoPlayerHandle } from './VideoPlayer';

const SPEED_OPTIONS = [0.25, 0.5, 1, 1.5, 2];

type Props = {
  playerRef: React.RefObject<VideoPlayerHandle | null>;
};

export function VideoControls({ playerRef }: Props) {
  const { state, dispatch } = useAnalytics();
  const isActive = state.streamStatus === 'playing';

  const togglePlay = useCallback(() => {
    const video = playerRef.current?.getVideoElement();
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [playerRef]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = playerRef.current?.getVideoElement();
    if (!video) return;
    video.currentTime = parseFloat(e.target.value);
  }, [playerRef]);

  const handleSpeedChange = useCallback((rate: number) => {
    const video = playerRef.current?.getVideoElement();
    if (!video) return;
    video.playbackRate = rate;
    dispatch({ type: 'SET_PLAYBACK_RATE', rate });
  }, [playerRef, dispatch]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = playerRef.current?.getVideoElement();
    if (!video) return;
    const vol = parseFloat(e.target.value);
    video.volume = vol;
    video.muted = vol === 0;
    dispatch({ type: 'SET_VOLUME', volume: vol });
  }, [playerRef, dispatch]);

  const toggleMute = useCallback(() => {
    const video = playerRef.current?.getVideoElement();
    if (!video) return;
    video.muted = !video.muted;
    dispatch({ type: 'SET_MUTED', muted: video.muted });
  }, [playerRef, dispatch]);

  const toggleFullscreen = useCallback(() => {
    const video = playerRef.current?.getVideoElement();
    if (!video) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      video.parentElement?.requestFullscreen();
    }
  }, [playerRef]);

  // Compute in/out marker positions as percentages
  const inPct = state.inPoint !== null && state.duration > 0
    ? (state.inPoint / state.duration) * 100 : null;
  const outPct = state.outPoint !== null && state.duration > 0
    ? (state.outPoint / state.duration) * 100 : null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      padding: '6px 12px',
      background: THEME.surface,
      borderTop: `1px solid ${THEME.borderSubtle}`,
    }}>
      {/* Timeline / Seek Bar */}
      <div style={{ position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
        {/* In/Out range highlight */}
        {inPct !== null && outPct !== null && (
          <div style={{
            position: 'absolute',
            left: `${inPct}%`,
            width: `${outPct - inPct}%`,
            height: 4,
            top: 8,
            background: 'rgba(245, 158, 11, 0.35)',
            borderRadius: 2,
            pointerEvents: 'none',
            zIndex: 1,
          }} />
        )}
        {/* In marker */}
        {inPct !== null && (
          <div style={{
            position: 'absolute',
            left: `${inPct}%`,
            top: 2,
            height: 16,
            width: 2,
            background: '#22c55e',
            borderRadius: 1,
            pointerEvents: 'none',
            zIndex: 2,
          }} />
        )}
        {/* Out marker */}
        {outPct !== null && (
          <div style={{
            position: 'absolute',
            left: `${outPct}%`,
            top: 2,
            height: 16,
            width: 2,
            background: '#ef4444',
            borderRadius: 1,
            pointerEvents: 'none',
            zIndex: 2,
          }} />
        )}
        {/* Bookmark dots */}
        {state.duration > 0 && state.bookmarks.map(bookmark => {
          const pct = (bookmark.time / state.duration) * 100;
          return (
            <div
              key={bookmark.id}
              onClick={(e) => {
                e.stopPropagation();
                const video = playerRef.current?.getVideoElement();
                if (video) video.currentTime = bookmark.time;
              }}
              title={bookmark.comment || formatTime(bookmark.time)}
              style={{
                position: 'absolute',
                left: `calc(${pct}% - 4px)`,
                top: 6,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: THEME.highlight,
                border: '1px solid rgba(0,0,0,0.3)',
                cursor: 'pointer',
                zIndex: 3,
              }}
            />
          );
        })}
        <input
          type="range"
          min={0}
          max={state.duration || 0}
          step={0.1}
          value={state.currentTime}
          onChange={handleSeek}
          disabled={!isActive}
          style={{
            width: '100%',
            height: 4,
            cursor: isActive ? 'pointer' : 'default',
            accentColor: THEME.highlight,
          }}
        />
      </div>

      {/* Controls Row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        {/* Play/Pause */}
        <button
          onClick={togglePlay}
          disabled={!isActive}
          style={{
            background: 'none',
            border: 'none',
            color: isActive ? THEME.secondary : THEME.textMuted,
            cursor: isActive ? 'pointer' : 'default',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
          }}
          title={state.isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        >
          {state.isPlaying ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6,4 20,12 6,20" />
            </svg>
          )}
        </button>

        {/* Time display */}
        <span style={{
          fontSize: 12,
          color: THEME.textMuted,
          fontVariantNumeric: 'tabular-nums',
          minWidth: 90,
        }}>
          {formatTime(state.currentTime)} / {formatTime(state.duration)}
        </span>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Speed */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {SPEED_OPTIONS.map(rate => (
            <button
              key={rate}
              onClick={() => handleSpeedChange(rate)}
              disabled={!isActive}
              style={{
                background: state.playbackRate === rate ? THEME.surfaceHover : 'none',
                border: state.playbackRate === rate ? `1px solid ${THEME.borderSubtle}` : '1px solid transparent',
                borderRadius: 4,
                color: state.playbackRate === rate ? THEME.secondary : THEME.textMuted,
                fontSize: 11,
                padding: '2px 6px',
                cursor: isActive ? 'pointer' : 'default',
                fontFamily: 'inherit',
              }}
            >
              {rate}x
            </button>
          ))}
        </div>

        {/* Volume */}
        <button
          onClick={toggleMute}
          disabled={!isActive}
          style={{
            background: 'none',
            border: 'none',
            color: THEME.textMuted,
            cursor: isActive ? 'pointer' : 'default',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {state.isMuted ? (
              <>
                <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="currentColor" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </>
            ) : (
              <>
                <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="currentColor" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </>
            )}
          </svg>
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={state.isMuted ? 0 : state.volume}
          onChange={handleVolumeChange}
          disabled={!isActive}
          style={{ width: 60, height: 3, accentColor: THEME.highlight }}
        />

        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          disabled={!isActive}
          style={{
            background: 'none',
            border: 'none',
            color: THEME.textMuted,
            cursor: isActive ? 'pointer' : 'default',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
          }}
          title="Fullscreen"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15,3 21,3 21,9" />
            <polyline points="9,21 3,21 3,15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </button>
      </div>
    </div>
  );
}
