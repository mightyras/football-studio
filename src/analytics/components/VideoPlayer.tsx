import { useRef, forwardRef, useImperativeHandle } from 'react';
import { useAnalytics } from '../AnalyticsContext';
import { useHlsPlayer } from '../hooks/useHlsPlayer';
import { THEME } from '../../constants/colors';

export type VideoPlayerHandle = {
  getVideoElement: () => HTMLVideoElement | null;
};

export const VideoPlayer = forwardRef<VideoPlayerHandle>(function VideoPlayer(_props, ref) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { state } = useAnalytics();

  useHlsPlayer(videoRef);

  useImperativeHandle(ref, () => ({
    getVideoElement: () => videoRef.current,
  }));

  const showPlaceholder = state.streamStatus === 'idle' || state.streamStatus === 'error';
  const showLoading = state.streamStatus === 'loading' || state.streamStatus === 'resolving';

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      aspectRatio: '16 / 9',
      background: '#000',
      borderRadius: 4,
      overflow: 'hidden',
    }}>
      <video
        ref={videoRef}
        style={{
          width: '100%',
          height: '100%',
          display: showPlaceholder && !showLoading ? 'none' : 'block',
        }}
        playsInline
        crossOrigin="anonymous"
      />

      {/* Placeholder */}
      {state.streamStatus === 'idle' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: THEME.textMuted,
          fontSize: 14,
          gap: 8,
        }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polygon points="5,3 19,12 5,21" />
          </svg>
          <span>Paste a stream URL above to get started</span>
        </div>
      )}

      {/* Loading */}
      {showLoading && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: THEME.secondary,
          fontSize: 14,
        }}>
          {state.streamStatus === 'resolving' ? 'Detecting stream...' : 'Loading stream...'}
        </div>
      )}

      {/* Error */}
      {state.streamStatus === 'error' && state.streamError && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
        }}>
          <div style={{
            background: THEME.surfaceRaised,
            border: `1px solid ${THEME.borderSubtle}`,
            borderRadius: 8,
            padding: '16px 24px',
            maxWidth: 480,
            color: THEME.secondary,
            fontSize: 13,
            lineHeight: 1.5,
            whiteSpace: 'pre-line',
          }}>
            <div style={{ color: '#ef4444', fontWeight: 600, marginBottom: 8 }}>Stream Error</div>
            {state.streamError}
          </div>
        </div>
      )}
    </div>
  );
});
