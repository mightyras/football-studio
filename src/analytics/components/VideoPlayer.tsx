import { useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useAnalytics } from '../AnalyticsContext';
import { useHlsPlayer } from '../hooks/useHlsPlayer';
import { THEME } from '../../constants/colors';

export type VideoPlayerHandle = {
  getVideoElement: () => HTMLVideoElement | null;
};

export const VideoPlayer = forwardRef<VideoPlayerHandle>(function VideoPlayer(_props, ref) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { state, dispatch } = useAnalytics();

  useHlsPlayer(videoRef);

  useImperativeHandle(ref, () => ({
    getVideoElement: () => videoRef.current,
  }));

  // Re-selection handler for local file sessions
  const handleFileReselect = useCallback((file: File) => {
    const objectUrl = URL.createObjectURL(file);
    dispatch({ type: 'SET_RESOLVED_STREAM_URL', url: objectUrl });
    dispatch({ type: 'SET_STREAM_STATUS', status: 'loading' });
    dispatch({
      type: 'SET_LOCAL_FILE_HINT',
      hint: { fileName: file.name, fileSize: file.size, lastModified: file.lastModified },
    });
  }, [dispatch]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      handleFileReselect(file);
    }
  }, [handleFileReselect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const showPlaceholder = state.streamStatus === 'idle' || state.streamStatus === 'error';
  const showLoading = state.streamStatus === 'loading' || state.streamStatus === 'resolving';

  // Local file session loaded but no video URL yet → needs re-selection
  const needsFileReselection = state.sourceType === 'local_file' && state.sessionId && !state.resolvedStreamUrl && state.streamStatus === 'idle';

  // Don't set crossOrigin for blob URLs (causes issues)
  const isBlobUrl = state.resolvedStreamUrl?.startsWith('blob:');

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
          display: (showPlaceholder || needsFileReselection) && !showLoading ? 'none' : 'block',
        }}
        playsInline
        crossOrigin={isBlobUrl ? undefined : 'anonymous'}
      />

      {/* Re-selection overlay for local file sessions */}
      {needsFileReselection && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: THEME.textMuted,
            fontSize: 14,
            gap: 12,
            cursor: 'pointer',
            border: '2px dashed rgba(139, 92, 246, 0.3)',
            borderRadius: 4,
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
            <polygon points="10 12 10 18 15 15" />
          </svg>
          <span>Select video file to continue</span>
          {state.localFileHint && (
            <span style={{ fontSize: 12, color: THEME.textMuted, opacity: 0.7 }}>
              Previously: {state.localFileHint.fileName} ({formatFileSize(state.localFileHint.fileSize)})
            </span>
          )}
          <span style={{ fontSize: 11, color: THEME.textMuted, opacity: 0.5 }}>
            Click to browse or drag &amp; drop
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileReselect(file);
              e.target.value = '';
            }}
          />
        </div>
      )}

      {/* Placeholder */}
      {state.streamStatus === 'idle' && !needsFileReselection && (
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
