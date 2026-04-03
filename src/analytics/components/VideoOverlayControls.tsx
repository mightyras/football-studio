import { useCallback } from 'react';
import { useAnalytics } from '../AnalyticsContext';
import { THEME } from '../../constants/colors';
import type { VideoPlayerHandle } from './VideoPlayer';

type Props = {
  playerRef: React.RefObject<VideoPlayerHandle | null>;
  clipCount: number;
  clipsOpen: boolean;
  onToggleClips: () => void;
};

const pillStyle: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.85)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: 20,
  padding: '5px 8px',
  pointerEvents: 'auto',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

export function VideoOverlayControls({ playerRef, clipCount, clipsOpen, onToggleClips }: Props) {
  const { state } = useAnalytics();
  const isActive = state.streamStatus === 'playing';

  const togglePlay = useCallback(() => {
    const video = playerRef.current?.getVideoElement();
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }, [playerRef]);

  const skipBack = useCallback(() => {
    const video = playerRef.current?.getVideoElement();
    if (video) video.currentTime = Math.max(0, video.currentTime - 10);
  }, [playerRef]);

  const skipForward = useCallback(() => {
    const video = playerRef.current?.getVideoElement();
    if (video) video.currentTime = Math.min(video.duration, video.currentTime + 10);
  }, [playerRef]);

  const toggleFullscreen = useCallback(() => {
    const video = playerRef.current?.getVideoElement();
    if (!video) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      video.parentElement?.requestFullscreen();
    }
  }, [playerRef]);

  if (!isActive) return null;

  const btnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.85)',
    cursor: 'pointer',
    padding: 0,
  };

  return (
    <>
      {/* Play/Pause + Skip + Fullscreen — bottom-left */}
      <div style={{
        position: 'absolute',
        bottom: 12,
        left: 12,
        zIndex: 5,
        ...pillStyle,
        padding: '4px 8px',
        gap: 4,
      }}>
        {/* Play/Pause */}
        <button
          onClick={togglePlay}
          title={state.isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          style={btnStyle}
        >
          {state.isPlaying ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6,4 20,12 6,20" />
            </svg>
          )}
        </button>

        {/* Skip back 10s */}
        <button
          onClick={skipBack}
          title="Back 10s"
          style={{ ...btnStyle, width: 32, height: 32 }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1,4 1,10 7,10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            <text x="12" y="16" textAnchor="middle" fill="currentColor" stroke="none" fontSize="8" fontWeight="700">10</text>
          </svg>
        </button>

        {/* Skip forward 10s */}
        <button
          onClick={skipForward}
          title="Forward 10s"
          style={{ ...btnStyle, width: 32, height: 32 }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23,4 23,10 17,10" />
            <path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10" />
            <text x="12" y="16" textAnchor="middle" fill="currentColor" stroke="none" fontSize="8" fontWeight="700">10</text>
          </svg>
        </button>

        {/* Divider */}
        <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.15)' }} />

        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          title="Fullscreen"
          style={{ ...btnStyle, color: 'rgba(255, 255, 255, 0.7)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15,3 21,3 21,9" />
            <polyline points="9,21 3,21 3,15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </button>
      </div>

      {/* Clips toggle — bottom-right */}
      {clipCount > 0 && (
        <div style={{
          position: 'absolute',
          bottom: 12,
          right: 10,
          zIndex: 5,
          ...pillStyle,
          padding: '4px 6px',
        }}>
          <button
            onClick={onToggleClips}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 14px',
              background: clipsOpen ? THEME.highlight : 'transparent',
              border: 'none', borderRadius: 16,
              color: clipsOpen ? '#000' : 'rgba(255,255,255,0.85)',
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            Clips ({clipCount})
          </button>
        </div>
      )}
    </>
  );
}
