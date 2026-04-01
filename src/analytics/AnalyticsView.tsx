import { useRef, useCallback, useEffect, useState } from 'react';
import { AnalyticsProvider, useAnalytics } from './AnalyticsContext';
import { StreamUrlBar } from './components/StreamUrlBar';
import { VideoPlayer, type VideoPlayerHandle } from './components/VideoPlayer';
import { VideoControls } from './components/VideoControls';
import { ClipActions } from './components/ClipActions';
import { SessionClipList } from './components/SessionClipList';
import { BookmarkList } from './components/BookmarkList';
import { ClipViewer } from './components/ClipViewer';
import { SessionBrowser } from './components/SessionBrowser';
import { CapturePreview } from './components/CapturePreview';
import { SaveToast } from './components/SaveToast';
import { useScreenshotCapture } from './hooks/useScreenshotCapture';
import { useClipRecorder } from './hooks/useClipRecorder';
import { useAnalyticsAutoSave } from './hooks/useAnalyticsAutoSave';
import { detectUrlType } from './utils/urlDetector';
import { supabase } from '../lib/supabase';
import { THEME } from '../constants/colors';
import type { SessionClip } from './types';

function AnalyticsContent() {
  const playerRef = useRef<VideoPlayerHandle>(null);
  const { state, dispatch } = useAnalytics();
  const [clipTrayOpen, setClipTrayOpen] = useState(false);
  const [pendingClip, setPendingClip] = useState<SessionClip | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Get video element ref for hooks
  const getVideoRef = useCallback(() => ({
    current: playerRef.current?.getVideoElement() ?? null,
  }), []);

  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  // Keep a stable ref to the video element
  useEffect(() => {
    const interval = setInterval(() => {
      const el = playerRef.current?.getVideoElement();
      if (el && el !== videoElementRef.current) {
        videoElementRef.current = el;
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Callback for when a clip/screenshot is captured — show preview before saving
  const handleClipReady = useCallback((clip: SessionClip) => {
    setPendingClip(clip);
  }, []);

  const { captureScreenshot, saveScreenshot } = useScreenshotCapture(videoElementRef, handleClipReady);
  const { startRecording, stopRecording, saveVideoClip } = useClipRecorder(videoElementRef, handleClipReady);

  // Handle save from preview modal
  const handleSaveCapture = useCallback((label: string) => {
    if (!pendingClip) return;
    if (pendingClip.type === 'screenshot') {
      saveScreenshot(pendingClip, label);
    } else {
      saveVideoClip(pendingClip, label);
    }
    setPendingClip(null);
    setToastMessage(pendingClip.type === 'screenshot' ? 'Screenshot saved' : 'Video clip saved');
  }, [pendingClip, saveScreenshot, saveVideoClip]);

  const handleDiscardCapture = useCallback(() => {
    if (pendingClip) {
      // Revoke blob URLs
      if (pendingClip.thumbnailUrl) URL.revokeObjectURL(pendingClip.thumbnailUrl);
      if (pendingClip.downloadUrl && pendingClip.downloadUrl !== pendingClip.thumbnailUrl) URL.revokeObjectURL(pendingClip.downloadUrl);
    }
    setPendingClip(null);
  }, [pendingClip]);

  // Auto-save bookmarks to Supabase
  useAnalyticsAutoSave();

  // When a session is loaded via LOAD_SESSION, the streamUrl is set but not resolved.
  // Detect this and trigger resolution (without resetting session state).
  const prevStreamUrlRef = useRef(state.streamUrl);
  useEffect(() => {
    if (
      state.streamUrl &&
      state.streamStatus === 'loading' &&
      !state.resolvedStreamUrl &&
      state.sessionId &&
      prevStreamUrlRef.current !== state.streamUrl
    ) {
      prevStreamUrlRef.current = state.streamUrl;
      const detection = detectUrlType(state.streamUrl);
      if (detection.type === 'hls' || detection.type === 'mp4') {
        dispatch({ type: 'SET_RESOLVED_STREAM_URL', url: state.streamUrl });
      } else if (detection.type === 'known-platform' && detection.platform) {
        dispatch({ type: 'SET_STREAM_STATUS', status: 'resolving' });
        supabase.functions.invoke('extract-stream-url', {
          body: { url: state.streamUrl, platform: detection.platform },
        }).then(({ data, error }) => {
          if (!error && data?.streamUrl) {
            dispatch({ type: 'SET_RESOLVED_STREAM_URL', url: data.streamUrl });
          } else {
            dispatch({
              type: 'SET_STREAM_STATUS',
              status: 'error',
              error: 'Could not resolve stream for saved session. Paste the .m3u8 URL directly.',
            });
          }
        });
      } else {
        dispatch({
          type: 'SET_STREAM_STATUS',
          status: 'error',
          error: 'Could not resolve stream. Paste a .m3u8 URL directly.',
        });
      }
    }
    prevStreamUrlRef.current = state.streamUrl;
  }, [state.streamUrl, state.streamStatus, state.resolvedStreamUrl, state.sessionId, dispatch]);

  const showSessionBrowser = state.streamStatus === 'idle';

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const video = playerRef.current?.getVideoElement();

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          if (video) {
            if (video.paused) video.play().catch(() => {});
            else video.pause();
          }
          break;
        case 'i':
          if (video && state.streamStatus === 'playing') {
            dispatch({ type: 'SET_IN_POINT', time: video.currentTime });
            if (state.outPoint !== null && state.outPoint <= video.currentTime) {
              dispatch({ type: 'SET_OUT_POINT', time: null });
            }
          }
          break;
        case 'o':
          if (video && state.streamStatus === 'playing' && state.inPoint !== null) {
            if (video.currentTime > state.inPoint) {
              dispatch({ type: 'SET_OUT_POINT', time: video.currentTime });
            }
          }
          break;
        case 'r':
          if (state.recordingStatus === 'recording') {
            stopRecording();
          } else if (state.inPoint !== null && state.outPoint !== null) {
            startRecording();
          }
          break;
        case 'm':
          if (video && state.streamStatus === 'playing') {
            dispatch({
              type: 'ADD_BOOKMARK',
              bookmark: {
                id: crypto.randomUUID(),
                time: video.currentTime,
                comment: '',
                createdAt: Date.now(),
              },
            });
          }
          break;
        case 'arrowleft':
          if (video) {
            e.preventDefault();
            video.currentTime = Math.max(0, video.currentTime - (e.shiftKey ? 10 : 5));
          }
          break;
        case 'arrowright':
          if (video) {
            e.preventDefault();
            video.currentTime = Math.min(video.duration, video.currentTime + (e.shiftKey ? 10 : 5));
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.streamStatus, state.inPoint, state.outPoint, state.recordingStatus, dispatch, startRecording, stopRecording]);

  const isRecording = state.recordingStatus === 'recording';
  const clipCount = state.sessionClips.length;
  const bookmarkCount = state.bookmarks.length;
  const [bookmarkPanelOpen, setBookmarkPanelOpen] = useState(false);

  // Auto-open bookmark panel when first bookmark is added
  useEffect(() => {
    if (bookmarkCount > 0 && !bookmarkPanelOpen) {
      setBookmarkPanelOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookmarkCount > 0]);

  const seekTo = useCallback((time: number) => {
    const video = playerRef.current?.getVideoElement();
    if (video) {
      video.currentTime = time;
    }
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: THEME.primary,
      overflow: 'hidden',
    }}>
      {/* Session header / URL bar */}
      <StreamUrlBar />

      {/* Main content row: video + optional bookmarks panel */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
        minHeight: 0,
      }}>
        {/* Left: video area (position: relative for clips overlay) */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '0 8px',
          overflow: 'hidden',
          minHeight: 0,
          minWidth: 0,
          position: 'relative',
        }}>
          {/* Session browser when idle */}
          {showSessionBrowser && <SessionBrowser />}

          {/* Video Player — full width */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            minHeight: 0,
            border: isRecording ? '2px solid #dc2626' : '2px solid transparent',
            borderRadius: 6,
            transition: 'border-color 0.2s',
          }}>
            <VideoPlayer ref={playerRef} />
          </div>
          <VideoControls playerRef={playerRef} />
          <ClipActions
            playerRef={playerRef}
            onScreenshot={captureScreenshot}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            clipCount={clipCount}
            clipsOpen={clipTrayOpen}
            onToggleClips={() => setClipTrayOpen(prev => !prev)}
          />

          {/* Clips overlay — positioned at bottom of video area */}
          {clipTrayOpen && clipCount > 0 && (
            <div
              onClick={() => setClipTrayOpen(false)}
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                zIndex: 10,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
              }}
            >
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  background: THEME.surface,
                  borderTop: `1px solid ${THEME.borderSubtle}`,
                  borderRadius: '8px 8px 0 0',
                  padding: '0 0 8px',
                }}
              >
                {/* Overlay header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                }}>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: THEME.secondary,
                  }}>
                    Clips ({clipCount})
                  </span>
                  <button
                    onClick={() => setClipTrayOpen(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: THEME.textMuted,
                      cursor: 'pointer',
                      padding: 2,
                      fontSize: 16,
                      lineHeight: 1,
                    }}
                  >
                    &times;
                  </button>
                </div>
                <SessionClipList />
              </div>
            </div>
          )}
        </div>

        {/* Right: Bookmarks panel or collapsed tab */}
        {bookmarkCount > 0 && (
          bookmarkPanelOpen ? (
            <div style={{
              width: 220,
              flexShrink: 0,
              borderLeft: `1px solid ${THEME.borderSubtle}`,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}>
              <BookmarkList
                onSeek={seekTo}
                onClose={() => setBookmarkPanelOpen(false)}
              />
            </div>
          ) : (
            /* Collapsed tab — visually attached to the right edge */
            <button
              onClick={() => setBookmarkPanelOpen(true)}
              style={{
                flexShrink: 0,
                alignSelf: 'flex-start',
                marginTop: 12,
                writingMode: 'vertical-lr',
                background: THEME.surface,
                border: `1px solid ${THEME.borderSubtle}`,
                borderRight: 'none',
                borderRadius: '6px 0 0 6px',
                padding: '12px 6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: THEME.highlight,
                fontSize: 11,
                fontWeight: 600,
                fontFamily: 'inherit',
                letterSpacing: '0.5px',
              }}
              title="Open bookmarks panel"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" style={{ transform: 'rotate(0deg)' }}>
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              {bookmarkCount}
            </button>
          )
        )}
      </div>

      {/* Bottom bar: keyboard shortcuts */}
      {state.streamStatus === 'playing' && (
        <div style={{
          background: THEME.surface,
          borderTop: `1px solid ${THEME.borderSubtle}`,
          padding: '4px 12px',
          fontSize: 10,
          color: THEME.textMuted,
          textAlign: 'center',
        }}>
          Space: Play/Pause &nbsp; I: Start &nbsp; O: End &nbsp; R: Record clip &nbsp; M: Bookmark &nbsp; Arrows: Seek
        </div>
      )}

      {/* Clip viewer overlay */}
      {state.selectedClipId && <ClipViewer />}

      {/* Capture preview modal */}
      {pendingClip && (
        <CapturePreview
          clip={pendingClip}
          onSave={handleSaveCapture}
          onDiscard={handleDiscardCapture}
        />
      )}

      {/* Save toast */}
      {toastMessage && (
        <SaveToast
          message={toastMessage}
          onDone={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}

export function AnalyticsView() {
  return (
    <AnalyticsProvider>
      <AnalyticsContent />
    </AnalyticsProvider>
  );
}
