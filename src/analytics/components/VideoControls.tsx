import { useCallback, useState, useEffect, useRef } from 'react';
import { useAnalytics } from '../AnalyticsContext';
import { formatTime } from '../utils/time';
import { THEME } from '../../constants/colors';
import { BOOKMARK_CATEGORY_LABELS } from '../types';
import { getStandardBookmarks, hasAllStandardBookmarks } from '../utils/matchClock';
import type { VideoPlayerHandle } from './VideoPlayer';

const SPEED_OPTIONS = [0.25, 0.5, 1, 1.5, 2];

type Props = {
  playerRef: React.RefObject<VideoPlayerHandle | null>;
  onScreenshot: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
};

export function VideoControls({ playerRef, onScreenshot, onStartRecording, onStopRecording }: Props) {
  const { state, dispatch } = useAnalytics();
  const isActive = state.streamStatus === 'playing';
  const [speedPopoverOpen, setSpeedPopoverOpen] = useState(false);
  const [clipMode, setClipMode] = useState(false);
  const speedRef = useRef<HTMLDivElement>(null);

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
    setSpeedPopoverOpen(false);
  }, [playerRef, dispatch]);

  // Exit clip mode when video starts playing or recording starts
  useEffect(() => {
    if (state.isPlaying || state.recordingStatus === 'recording') {
      setClipMode(false);
    }
  }, [state.isPlaying, state.recordingStatus]);

  // Clear in/out points when exiting clip mode
  const handleExitClipMode = useCallback(() => {
    setClipMode(false);
    dispatch({ type: 'SET_IN_POINT', time: null });
    dispatch({ type: 'SET_OUT_POINT', time: null });
  }, [dispatch]);

  // Click-outside to close speed popover
  useEffect(() => {
    if (!speedPopoverOpen) return;
    const handler = (e: MouseEvent) => {
      if (speedRef.current && !speedRef.current.contains(e.target as Node)) {
        setSpeedPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [speedPopoverOpen]);

  // Zoomed timeline range when in clip mode
  const MAX_CLIP_DURATION = 30;
  const ZOOM_PADDING = 5; // seconds before start point
  const zoomMin = clipMode && state.inPoint !== null
    ? Math.max(0, state.inPoint - ZOOM_PADDING) : 0;
  const zoomMax = clipMode && state.inPoint !== null
    ? Math.min(state.duration || 0, state.inPoint + MAX_CLIP_DURATION + ZOOM_PADDING) : (state.duration || 0);
  const zoomRange = zoomMax - zoomMin || 1;

  // Helper: convert absolute time to percentage within current timeline range
  const timeToPct = (t: number) => ((t - zoomMin) / zoomRange) * 100;

  // Compute in/out marker positions as percentages
  const inPct = state.inPoint !== null && state.duration > 0
    ? timeToPct(state.inPoint) : null;
  const outPct = state.outPoint !== null && state.duration > 0
    ? timeToPct(state.outPoint) : null;

  // Playhead popup state
  const isPaused = isActive && !state.isPlaying;
  const notRecording = state.recordingStatus !== 'recording';
  const showPlayheadPopup = isPaused && notRecording && state.duration > 0;
  const playheadPct = state.duration > 0 ? timeToPct(state.currentTime) : 0;

  const hasStart = state.inPoint !== null;
  const hasEnd = state.outPoint !== null;
  const hasRange = hasStart && hasEnd && state.outPoint! > state.inPoint!;
  const clipDuration = hasRange ? state.outPoint! - state.inPoint! : 0;
  const liveClipDuration = hasStart ? Math.max(0, state.currentTime - state.inPoint!) : 0;
  const canSetEnd = hasStart && state.currentTime > state.inPoint! && (state.currentTime - state.inPoint!) <= MAX_CLIP_DURATION;
  const isClipMode = clipMode && showPlayheadPopup;

  // Normal timeline helper: convert time to pct using full duration
  const fullTimeToPct = (t: number) => state.duration > 0 ? (t / state.duration) * 100 : 0;

  // Normal timeline marker positions (full duration)
  const normalInPct = state.inPoint !== null && state.duration > 0
    ? fullTimeToPct(state.inPoint) : null;
  const normalOutPct = state.outPoint !== null && state.duration > 0
    ? fullTimeToPct(state.outPoint) : null;

  return (
    <>
      {/* Floating clip mode panel — overlays bottom of video */}
      {isClipMode && (
        <div style={{
          position: 'absolute',
          bottom: 54,
          left: 4,
          right: 4,
          zIndex: 15,
          pointerEvents: 'auto',
        }}>
          <div style={{
            background: 'rgba(0, 0, 0, 0.94)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px 12px 0 0',
            padding: '12px 16px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}>
            {/* Top row: status + actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Clip icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2">
                <rect x="2" y="2" width="20" height="20" rx="2.18" />
                <line x1="7" y1="2" x2="7" y2="22" />
                <line x1="17" y1="2" x2="17" y2="22" />
              </svg>

              {/* Status text */}
              {!hasStart && (
                <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, flex: 1 }}>
                  Scrub to clip <strong style={{ color: '#22c55e' }}>start</strong> position
                </span>
              )}
              {hasStart && !hasEnd && (
                <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, flex: 1 }}>
                  {canSetEnd ? (
                    <>
                      Clip length: <strong style={{ color: '#fff' }}>{formatTime(liveClipDuration)}</strong>
                      <span style={{ color: 'rgba(255,255,255,0.45)', marginLeft: 6, fontSize: 12 }}>
                        max {MAX_CLIP_DURATION}s
                      </span>
                    </>
                  ) : (
                    <>Scrub forward to set <strong style={{ color: '#ef4444' }}>end</strong> point</>
                  )}
                </span>
              )}
              {hasRange && (
                <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, flex: 1 }}>
                  Clip length: <strong style={{ color: '#fff' }}>{formatTime(clipDuration)}</strong>
                  {clipDuration > MAX_CLIP_DURATION && (
                    <span style={{ color: '#f59e0b', marginLeft: 8, fontSize: 12 }}>
                      Exceeds {MAX_CLIP_DURATION}s limit
                    </span>
                  )}
                </span>
              )}

              {/* Action buttons */}
              {!hasStart && (
                <button
                  onClick={() => dispatch({ type: 'SET_IN_POINT', time: state.currentTime })}
                  style={{
                    padding: '6px 16px', background: '#22c55e',
                    border: 'none', borderRadius: 6,
                    color: '#000', fontSize: 13, fontWeight: 700,
                    fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  Set start
                </button>
              )}
              {hasStart && !hasEnd && (
                <button
                  onClick={() => {
                    if (canSetEnd) dispatch({ type: 'SET_OUT_POINT', time: state.currentTime });
                  }}
                  disabled={!canSetEnd}
                  style={{
                    padding: '6px 16px',
                    background: canSetEnd ? '#ef4444' : 'rgba(255,255,255,0.06)',
                    border: 'none', borderRadius: 6,
                    color: canSetEnd ? '#fff' : 'rgba(255,255,255,0.2)',
                    fontSize: 13, fontWeight: 700,
                    fontFamily: 'inherit',
                    cursor: canSetEnd ? 'pointer' : 'default',
                    flexShrink: 0,
                  }}
                >
                  Set end
                </button>
              )}
              {hasRange && (
                <button
                  onClick={onStartRecording}
                  disabled={clipDuration > MAX_CLIP_DURATION}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 18px',
                    background: clipDuration > MAX_CLIP_DURATION ? 'rgba(255,255,255,0.06)' : '#dc2626',
                    border: 'none', borderRadius: 6,
                    color: clipDuration > MAX_CLIP_DURATION ? 'rgba(255,255,255,0.2)' : '#fff',
                    fontSize: 13, fontWeight: 700,
                    fontFamily: 'inherit',
                    cursor: clipDuration > MAX_CLIP_DURATION ? 'default' : 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ width: 8, height: 8, background: clipDuration > MAX_CLIP_DURATION ? 'rgba(255,255,255,0.2)' : '#fff', borderRadius: '50%' }} />
                  Record clip
                </button>
              )}

              {/* Cancel */}
              <button
                onClick={handleExitClipMode}
                style={{
                  padding: '6px 14px',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  borderRadius: 6,
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                  cursor: 'pointer', flexShrink: 0,
                }}
              >
                Cancel
              </button>
            </div>

            {/* Zoomed timeline */}
            <div style={{ position: 'relative', height: 56, display: 'flex', alignItems: 'flex-end', paddingBottom: 14 }}>
              {/* In/Out range highlight */}
              {inPct !== null && outPct !== null && (
                <div style={{
                  position: 'absolute',
                  left: `${inPct}%`,
                  width: `${outPct - inPct}%`,
                  height: 10,
                  bottom: 17,
                  background: 'rgba(245, 158, 11, 0.3)',
                  borderRadius: 2,
                  pointerEvents: 'none',
                  zIndex: 1,
                }} />
              )}
              {/* In marker — diamond */}
              {inPct !== null && (
                <div style={{
                  position: 'absolute',
                  left: `${inPct}%`,
                  bottom: 16,
                  transform: 'translateX(-50%) rotate(45deg)',
                  width: 10,
                  height: 10,
                  background: '#22c55e',
                  borderRadius: 2,
                  pointerEvents: 'none',
                  zIndex: 2,
                }} />
              )}
              {/* Out marker — diamond */}
              {outPct !== null && (
                <div style={{
                  position: 'absolute',
                  left: `${outPct}%`,
                  bottom: 16,
                  transform: 'translateX(-50%) rotate(45deg)',
                  width: 10,
                  height: 10,
                  background: '#ef4444',
                  borderRadius: 2,
                  pointerEvents: 'none',
                  zIndex: 2,
                }} />
              )}
              {/* Start label above in-point */}
              {hasStart && inPct !== null && (
                <div style={{
                  position: 'absolute',
                  left: `${inPct}%`,
                  top: 0,
                  transform: 'translateX(-50%)',
                  pointerEvents: 'none',
                  zIndex: 6,
                }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: '#22c55e',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {formatTime(state.inPoint!)}
                  </span>
                </div>
              )}
              {/* Playhead label — live duration when scrubbing for end */}
              {hasStart && !hasEnd && (
                <div style={{
                  position: 'absolute',
                  left: `${Math.max(8, Math.min(92, playheadPct))}%`,
                  top: 0,
                  transform: 'translateX(-50%)',
                  zIndex: 7,
                  whiteSpace: 'nowrap',
                }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700,
                    color: canSetEnd ? '#ef4444' : 'rgba(255,255,255,0.4)',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {formatTime(state.currentTime)}
                    {liveClipDuration > 0 && (
                      <span style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 500, marginLeft: 4 }}>
                        ({formatTime(liveClipDuration)})
                      </span>
                    )}
                  </span>
                </div>
              )}
              {/* Out-point label */}
              {hasEnd && outPct !== null && (
                <div style={{
                  position: 'absolute',
                  left: `${outPct}%`,
                  top: 0,
                  transform: 'translateX(-50%)',
                  pointerEvents: 'none',
                  zIndex: 6,
                }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: '#ef4444',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {formatTime(state.outPoint!)}
                  </span>
                </div>
              )}
              {/* Range slider */}
              <input
                type="range"
                min={zoomMin}
                max={zoomMax}
                step={0.1}
                value={state.currentTime}
                onChange={handleSeek}
                style={{
                  width: '100%',
                  height: 10,
                  cursor: 'pointer',
                  accentColor: THEME.highlight,
                }}
              />
              {/* Edge time labels */}
              <span style={{
                position: 'absolute', left: 0, bottom: 0,
                fontSize: 10, color: 'rgba(255,255,255,0.3)',
                fontVariantNumeric: 'tabular-nums', pointerEvents: 'none',
              }}>{formatTime(zoomMin)}</span>
              <span style={{
                position: 'absolute', right: 0, bottom: 0,
                fontSize: 10, color: 'rgba(255,255,255,0.3)',
                fontVariantNumeric: 'tabular-nums', pointerEvents: 'none',
              }}>{formatTime(zoomMax)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Capture options — floating pill overlay centered on video, visible when paused */}
      {showPlayheadPopup && !clipMode && (
        <div style={{
          position: 'absolute',
          bottom: 68,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 15,
          pointerEvents: 'auto',
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 20,
          padding: '5px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <button
            onClick={onScreenshot}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 14px',
              background: 'transparent',
              border: 'none', borderRadius: 16,
              color: 'rgba(255,255,255,0.85)',
              fontSize: 13, fontWeight: 600,
              fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Screenshot
          </button>

          <button
            onClick={() => {
              setClipMode(true);
              dispatch({ type: 'SET_IN_POINT', time: state.currentTime });
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 14px',
              background: 'transparent',
              border: 'none', borderRadius: 16,
              color: 'rgba(255,255,255,0.85)',
              fontSize: 13, fontWeight: 600,
              fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="2" width="20" height="20" rx="2.18" />
              <line x1="7" y1="2" x2="7" y2="22" />
              <line x1="17" y1="2" x2="17" y2="22" />
              <line x1="2" y1="12" x2="22" y2="12" />
            </svg>
            Video clip
          </button>
        </div>
      )}

      {/* Normal controls bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 8px',
        background: THEME.surface,
        borderTop: `1px solid ${THEME.borderSubtle}`,
      }}>
        {/* Timeline / Seek Bar */}
        <div style={{ position: 'relative', height: 40, flex: 1, display: 'flex', alignItems: 'center' }}>
          {/* In/Out range highlight (normal timeline) */}
          {normalInPct !== null && normalOutPct !== null && (
            <div style={{
              position: 'absolute',
              left: `${normalInPct}%`,
              width: `${normalOutPct - normalInPct}%`,
              height: 8,
              top: 16,
              background: 'rgba(245, 158, 11, 0.35)',
              borderRadius: 2,
              pointerEvents: 'none',
              zIndex: 1,
            }} />
          )}
          {/* In marker */}
          {normalInPct !== null && (
            <div style={{
              position: 'absolute',
              left: `${normalInPct}%`,
              top: 4,
              height: 32,
              width: 2,
              background: '#22c55e',
              borderRadius: 1,
              pointerEvents: 'none',
              zIndex: 2,
            }} />
          )}
          {/* Out marker */}
          {normalOutPct !== null && (
            <div style={{
              position: 'absolute',
              left: `${normalOutPct}%`,
              top: 4,
              height: 32,
              width: 2,
              background: '#ef4444',
              borderRadius: 1,
              pointerEvents: 'none',
              zIndex: 2,
            }} />
          )}
          {/* Period shading when all standard bookmarks are set */}
          {state.duration > 0 && hasAllStandardBookmarks(state.bookmarks) && (() => {
            const std = getStandardBookmarks(state.bookmarks);
            const koPct = fullTimeToPct(std.kickoff!.time);
            const htPct = fullTimeToPct(std.halftime!.time);
            const s2hPct = fullTimeToPct(std.start2ndHalf!.time);
            const endPctVal = fullTimeToPct(std.end!.time);
            return (
              <>
                <div style={{
                  position: 'absolute', left: `${koPct}%`, width: `${htPct - koPct}%`,
                  height: 8, top: 16, background: 'rgba(34, 197, 94, 0.12)', borderRadius: 2,
                  pointerEvents: 'none', zIndex: 1,
                }} />
                <div style={{
                  position: 'absolute', left: `${s2hPct}%`, width: `${endPctVal - s2hPct}%`,
                  height: 8, top: 16, background: 'rgba(59, 130, 246, 0.12)', borderRadius: 2,
                  pointerEvents: 'none', zIndex: 1,
                }} />
              </>
            );
          })()}
          {/* Bookmark markers */}
          {state.duration > 0 && state.bookmarks.map(bookmark => {
            const pct = fullTimeToPct(bookmark.time);
            const isGoal = bookmark.category === 'goal';

            // Goal bookmark: small white circle marker
            if (isGoal) {
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
                    left: `calc(${pct}% - 5px)`,
                    top: 12,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: '#ffffff',
                    border: '2px solid rgba(0,0,0,0.4)',
                    cursor: 'pointer',
                    zIndex: 4,
                  }}
                />
              );
            }

            // Standard bookmark: vertical line with label
            if (bookmark.category) {
              const color = '#3b82f6';
              const labelEntry = BOOKMARK_CATEGORY_LABELS[bookmark.category as keyof typeof BOOKMARK_CATEGORY_LABELS];
              const label = labelEntry?.short ?? bookmark.category.toUpperCase();
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
                    left: `calc(${pct}% - 1px)`,
                    top: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: 'pointer',
                    zIndex: 3,
                  }}
                >
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color,
                    lineHeight: 1,
                    marginBottom: 1,
                    letterSpacing: '0.3px',
                  }}>
                    {label}
                  </span>
                  <div style={{
                    width: 2,
                    height: 20,
                    background: color,
                    borderRadius: 1,
                  }} />
                </div>
              );
            }

            // Custom bookmark: circular dot
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
                  left: `calc(${pct}% - 6px)`,
                  top: 14,
                  width: 12,
                  height: 12,
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
              height: 8,
              cursor: isActive ? 'pointer' : 'default',
              accentColor: THEME.highlight,
            }}
          />

          {/* Playhead popup is now rendered as a floating overlay outside the timeline — see below */}

          {/* Recording indicator + stop button on timeline */}
          {state.recordingStatus === 'recording' && normalInPct !== null && normalOutPct !== null && (
            <>
              <div style={{
                position: 'absolute',
                left: `${normalInPct}%`,
                width: `${normalOutPct - normalInPct}%`,
                height: 8,
                top: 16,
                background: 'rgba(220, 38, 38, 0.4)',
                borderRadius: 2,
                pointerEvents: 'none',
                zIndex: 1,
              }} />
              <div style={{
                position: 'absolute',
                bottom: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginBottom: 6,
                zIndex: 10,
              }}>
                <button
                  onClick={onStopRecording}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 12px',
                    background: '#dc2626',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 8,
                    color: '#fff', fontSize: 11, fontWeight: 600,
                    fontFamily: 'inherit', cursor: 'pointer',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <div style={{ width: 7, height: 7, background: '#fff', borderRadius: 2 }} />
                  Stop {formatTime(state.recordingElapsed)}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Time display */}
        {isActive && (
          <span style={{
            fontSize: 11,
            fontVariantNumeric: 'tabular-nums',
            color: THEME.textMuted,
            letterSpacing: '-0.2px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}>
            {formatTime(state.currentTime)} / {formatTime(state.duration)}
          </span>
        )}

        {/* Settings gear */}
        <div ref={speedRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setSpeedPopoverOpen(prev => !prev)}
            disabled={!isActive}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              borderRadius: 4,
              background: speedPopoverOpen ? THEME.surfaceHover : 'transparent',
              border: 'none',
              color: THEME.textMuted,
              cursor: isActive ? 'pointer' : 'default',
              padding: 0,
            }}
            title="Playback speed"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>

          {/* Speed popover */}
          {speedPopoverOpen && (
            <div style={{
              position: 'absolute',
              bottom: '100%',
              right: 0,
              marginBottom: 6,
              background: 'rgba(0, 0, 0, 0.9)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 8,
              padding: '4px',
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              zIndex: 10,
            }}>
              {SPEED_OPTIONS.map(rate => (
                <button
                  key={rate}
                  onClick={() => handleSpeedChange(rate)}
                  style={{
                    padding: '5px 14px',
                    background: state.playbackRate === rate ? 'rgba(255,255,255,0.12)' : 'transparent',
                    border: 'none',
                    borderRadius: 4,
                    color: state.playbackRate === rate ? THEME.highlight : 'rgba(255,255,255,0.7)',
                    fontSize: 12,
                    fontWeight: state.playbackRate === rate ? 700 : 400,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    textAlign: 'right',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {rate}x
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
