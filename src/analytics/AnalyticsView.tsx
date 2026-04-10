import { useRef, useCallback, useEffect, useState } from 'react';
import { AnalyticsProvider, useAnalytics } from './AnalyticsContext';
import { StreamUrlBar } from './components/StreamUrlBar';
import { VideoPlayer, type VideoPlayerHandle } from './components/VideoPlayer';
import { VideoControls } from './components/VideoControls';
import { SessionClipList } from './components/SessionClipList';
import { BookmarkList } from './components/BookmarkList';
import { ClipViewer } from './components/ClipViewer';
import { SessionBrowser } from './components/SessionBrowser';
import { CapturePreview } from './components/CapturePreview';
import { SaveToast } from './components/SaveToast';
import { VideoDrawingOverlay } from './components/VideoDrawingOverlay';
import { DrawingToolbar } from './components/DrawingToolbar';
import { MovePlayerOverlay, type MovePlayerOverlayHandle } from './components/MovePlayerOverlay';
import { BookmarkPicker } from './components/BookmarkPicker';
import { GoalTeamPicker } from './components/GoalTeamPicker';
import { MatchResultsPanel } from './components/MatchResultsPanel';
import { MatchClock } from './components/MatchClock';
import { MatchInfoPanel } from './components/MatchInfoPanel';
import { VideoOverlayControls } from './components/VideoOverlayControls';
import { useScreenshotCapture } from './hooks/useScreenshotCapture';
import { useClipRecorder } from './hooks/useClipRecorder';
import { useAnalyticsAutoSave } from './hooks/useAnalyticsAutoSave';
import { useAuth } from '../state/AuthContext';
import { detectUrlType } from './utils/urlDetector';
import { createEvent } from './services/analysisService';
import { supabase } from '../lib/supabase';
import { THEME } from '../constants/colors';
import type { SessionClip, BookmarkCategory } from './types';
import { BOOKMARK_CATEGORY_LABELS } from './types';

function AnalyticsContent() {
  const playerRef = useRef<VideoPlayerHandle>(null);
  const { state, dispatch } = useAnalytics();
  const { user, profile } = useAuth();
  const [clipTrayOpen, setClipTrayOpen] = useState(false);
  const [pendingClip, setPendingClip] = useState<SessionClip | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const movePlayerRef = useRef<MovePlayerOverlayHandle>(null);

  // Callback for screenshot capture: returns clean composite from move-player overlay
  const getMovePlayerComposite = useCallback(() => {
    return movePlayerRef.current?.buildComposite() ?? null;
  }, []);
  const [showBookmarkPicker, setShowBookmarkPicker] = useState(false);
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const bookmarkTimeRef = useRef(0);
  const kickoffSeekDoneRef = useRef<string | null>(null);

  // Auto-seek to ~10s before kickoff when loading a saved session
  useEffect(() => {
    if (
      state.streamStatus === 'playing' &&
      state.sessionId &&
      kickoffSeekDoneRef.current !== state.sessionId
    ) {
      const kickoff = state.bookmarks.find(b => b.category === 'kickoff');
      if (kickoff) {
        kickoffSeekDoneRef.current = state.sessionId;
        const video = playerRef.current?.getVideoElement();
        if (video) {
          video.currentTime = Math.max(0, kickoff.time - 10);
        }
      }
    }
  }, [state.streamStatus, state.sessionId, state.bookmarks]);

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

  const { captureScreenshot, saveScreenshot } = useScreenshotCapture(videoElementRef, handleClipReady, getMovePlayerComposite);
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
        supabase!.functions.invoke('extract-stream-url', {
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
      // Don't capture when typing in input fields or when ClipViewer is open
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (state.selectedClipId) return;

      const video = playerRef.current?.getVideoElement();

      // Ctrl/Cmd+Z to undo last annotation
      if (e.key.toLowerCase() === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        const lastAnnotation = state.annotations[state.annotations.length - 1];
        if (lastAnnotation) {
          dispatch({ type: 'DELETE_ANNOTATION', id: lastAnnotation.id });
        }
        return;
      }

      // Block all keys when move-player tool is active (overlay handles its own keys)
      if (state.activeTool === 'move-player') return;

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
          if (video && state.streamStatus === 'playing' && !showBookmarkPicker) {
            bookmarkTimeRef.current = video.currentTime;
            setShowBookmarkPicker(true);
          }
          break;
        case 'd':
          dispatch({
            type: 'SET_ACTIVE_TOOL',
            tool: state.activeTool === 'freehand' ? 'select' : 'freehand',
          });
          break;
        case 'p':
          if (!state.isPlaying && state.streamStatus === 'playing') {
            dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'move-player' });
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
  }, [state.streamStatus, state.inPoint, state.outPoint, state.recordingStatus, state.activeTool, state.selectedClipId, state.annotations, showBookmarkPicker, dispatch, startRecording, stopRecording]);

  // Clear freehand strokes and move-player state when video resumes playing
  const prevPlayingRef = useRef(state.isPlaying);
  useEffect(() => {
    if (state.isPlaying && !prevPlayingRef.current) {
      if (!state.holdStrokesOnPause) {
        dispatch({ type: 'CLEAR_FREEHAND_ANNOTATIONS' });
      }
      if (state.movePlayerState) {
        dispatch({ type: 'CLEAR_MOVE_PLAYER_STATE' });
      }
    }
    prevPlayingRef.current = state.isPlaying;
  }, [state.isPlaying, state.holdStrokesOnPause, state.movePlayerState, dispatch]);

  const isRecording = state.recordingStatus === 'recording';
  const clipCount = state.sessionClips.length;
  const bookmarkCount = state.bookmarks.length;
  const [bookmarkPanelOpen, setBookmarkPanelOpen] = useState(false);
  const [autoEditBookmarkId, setAutoEditBookmarkId] = useState<string | null>(null);

  const hasSourceFiles = state.sourceFiles.length > 1;

  // Auto-open bookmark panel when first bookmark is added or source files are loaded
  useEffect(() => {
    if ((bookmarkCount > 0 || hasSourceFiles) && !bookmarkPanelOpen) {
      setBookmarkPanelOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookmarkCount > 0, hasSourceFiles]);

  const seekTo = useCallback((time: number) => {
    const video = playerRef.current?.getVideoElement();
    if (video) {
      video.currentTime = time;
    }
  }, []);

  const handleGoalScoreConfirm = useCallback((homeScore: number, awayScore: number) => {
    setShowGoalPicker(false);
    const time = bookmarkTimeRef.current;
    const localId = crypto.randomUUID();
    const ownerId = user?.id;
    const createdByName = profile?.display_name ?? undefined;
    const category: BookmarkCategory = 'goal';
    const comment = `${homeScore} - ${awayScore}`;
    const sourceFileId = state.activeSourceFileId ?? undefined;

    const bookmark = {
      id: localId, time, comment, createdAt: Date.now(),
      category, ownerId, createdByName, sourceFileId,
    };
    dispatch({ type: 'ADD_BOOKMARK', bookmark });

    if (state.sessionId) {
      createEvent(state.sessionId, { time, comment, category, sourceFileId }).then(row => {
        if (row) {
          dispatch({ type: 'REMOVE_BOOKMARK', id: localId });
          dispatch({
            type: 'ADD_BOOKMARK',
            bookmark: { ...bookmark, cloudId: row.id },
          });
        }
      });
    }
  }, [state.sessionId, state.activeSourceFileId, user?.id, profile?.display_name, dispatch]);

  const handleBookmarkSelect = useCallback((selection: BookmarkCategory | 'custom') => {
    setShowBookmarkPicker(false);

    if (selection === 'goal') {
      setShowGoalPicker(true);
      return;
    }

    const time = bookmarkTimeRef.current;
    const localId = crypto.randomUUID();
    const ownerId = user?.id;
    const createdByName = profile?.display_name ?? undefined;

    const sourceFileId = state.activeSourceFileId ?? undefined;

    if (selection === 'custom') {
      const bookmark = {
        id: localId, time, comment: '', createdAt: Date.now(),
        ownerId, createdByName, sourceFileId,
      };
      dispatch({ type: 'ADD_BOOKMARK', bookmark });
      // Auto-focus the comment field for the new bookmark
      setBookmarkPanelOpen(true);
      // Use setTimeout so the BookmarkList renders first, then receives the autoEditId
      setTimeout(() => setAutoEditBookmarkId(localId), 0);

      // Persist to DB
      if (state.sessionId) {
        createEvent(state.sessionId, { time, comment: '', sourceFileId }).then(row => {
          if (row) {
            // Patch in cloudId by replacing the bookmark
            dispatch({ type: 'REMOVE_BOOKMARK', id: localId });
            dispatch({
              type: 'ADD_BOOKMARK',
              bookmark: { ...bookmark, cloudId: row.id },
            });
          }
        });
      }
      return;
    }

    // Remove existing bookmark with same category (locally — DB-side handled by createEvent)
    const existing = state.bookmarks.find(b => b.category === selection);
    if (existing) {
      dispatch({ type: 'REMOVE_BOOKMARK', id: existing.id });
    }

    const comment = BOOKMARK_CATEGORY_LABELS[selection].full;
    const bookmark = {
      id: localId, time, comment, createdAt: Date.now(),
      category: selection, ownerId, createdByName, sourceFileId,
    };
    dispatch({ type: 'ADD_BOOKMARK', bookmark });

    // Persist to DB
    if (state.sessionId) {
      createEvent(state.sessionId, { time, comment, category: selection, sourceFileId }).then(row => {
        if (row) {
          dispatch({ type: 'REMOVE_BOOKMARK', id: localId });
          dispatch({
            type: 'ADD_BOOKMARK',
            bookmark: { ...bookmark, cloudId: row.id },
          });
        }
      });
    }
  }, [state.bookmarks, state.sessionId, state.activeSourceFileId, user?.id, profile?.display_name, dispatch]);

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
          padding: '0 4px',
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
            position: 'relative',
          }}>
            <VideoPlayer ref={playerRef} />
            <VideoDrawingOverlay
              videoElement={videoElementRef.current}
              mode="live"
            />
            <MovePlayerOverlay
              ref={movePlayerRef}
              videoElement={videoElementRef.current}
            />
            <MatchClock />
            <MatchResultsPanel />
            <MatchInfoPanel />
            {!showSessionBrowser && <DrawingToolbar />}
            <VideoOverlayControls
              playerRef={playerRef}
              clipCount={clipCount}
              clipsOpen={clipTrayOpen}
              onToggleClips={() => setClipTrayOpen(prev => !prev)}
            />
            {showBookmarkPicker && (
              <BookmarkPicker
                existingBookmarks={state.bookmarks}
                onSelect={handleBookmarkSelect}
                onDismiss={() => setShowBookmarkPicker(false)}
              />
            )}
            {showGoalPicker && (
              <GoalTeamPicker
                homeTeamName={state.urlMetadata?.homeTeam ?? null}
                awayTeamName={state.urlMetadata?.awayTeam ?? null}
                onConfirm={handleGoalScoreConfirm}
                onDismiss={() => setShowGoalPicker(false)}
              />
            )}
          </div>
          <VideoControls
            playerRef={playerRef}
            onScreenshot={captureScreenshot}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
          />

          {/* Clips overlay — positioned at bottom of video area */}
          {clipTrayOpen && clipCount > 0 && (
            <div
              onClick={() => setClipTrayOpen(false)}
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                zIndex: 20,
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
        {(bookmarkCount > 0 || hasSourceFiles) && (
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
                autoEditId={autoEditBookmarkId}
                onLeaveSession={() => {
                  const video = playerRef.current?.getVideoElement();
                  if (video) video.pause();
                }}
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
              title="Open events panel"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" style={{ transform: 'rotate(0deg)' }}>
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              {bookmarkCount}
            </button>
          )
        )}
      </div>

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
