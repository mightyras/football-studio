import { useState, useCallback } from 'react';
import { useAnalytics } from '../AnalyticsContext';
import { useAuth } from '../../state/AuthContext';
import { detectUrlType, extractUrlMetadata } from '../utils/urlDetector';
import { updateSession, updateEventComment, deleteEvent } from '../services/analysisService';
import { formatTime } from '../utils/time';
import { ConfirmDialog } from './ConfirmDialog';
import { THEME } from '../../constants/colors';
import { BOOKMARK_CATEGORY_LABELS } from '../types';
import { supabase } from '../../lib/supabase';

type Props = {
  onSeek: (time: number) => void;
  onClose?: () => void;
  onLeaveSession?: () => void;
};

export function BookmarkList({ onSeek, onClose, onLeaveSession }: Props) {
  const { state, dispatch } = useAnalytics();
  const { user } = useAuth();
  const isSessionOwner = state.sessionOwnerId === user?.id;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const startEditing = useCallback((id: string, currentComment: string) => {
    setEditingId(id);
    setEditValue(currentComment);
  }, []);

  const saveEdit = useCallback(() => {
    if (editingId) {
      dispatch({ type: 'UPDATE_BOOKMARK_COMMENT', id: editingId, comment: editValue });
      // Persist to DB
      const bookmark = state.bookmarks.find(b => b.id === editingId);
      if (bookmark?.cloudId) {
        updateEventComment(bookmark.cloudId, editValue);
      }
      setEditingId(null);
    }
  }, [editingId, editValue, dispatch, state.bookmarks]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const handleUrlUpdate = useCallback(async () => {
    const url = urlValue.trim();
    if (!url) return;
    setUrlDialogOpen(false);

    // Persist to DB
    if (state.sessionId) {
      updateSession(state.sessionId, { streamUrl: url });
    }

    // Update stream without resetting session/bookmarks
    dispatch({ type: 'UPDATE_STREAM_URL', url });

    const metadata = extractUrlMetadata(url);
    if (metadata) dispatch({ type: 'SET_URL_METADATA', metadata });

    const detection = detectUrlType(url);
    if (detection.type === 'hls' || detection.type === 'mp4') {
      dispatch({ type: 'SET_RESOLVED_STREAM_URL', url });
    } else if (detection.type === 'known-platform' && detection.platform) {
      dispatch({ type: 'SET_STREAM_STATUS', status: 'resolving' });
      try {
        const { data, error } = await supabase!.functions.invoke('extract-stream-url', {
          body: { url, platform: detection.platform },
        });
        if (!error && data?.streamUrl) {
          dispatch({ type: 'SET_RESOLVED_STREAM_URL', url: data.streamUrl });
        } else {
          dispatch({ type: 'SET_STREAM_STATUS', status: 'error', error: 'Could not resolve stream. Paste a .m3u8 URL directly.' });
        }
      } catch {
        dispatch({ type: 'SET_STREAM_STATUS', status: 'error', error: 'Could not resolve stream URL.' });
      }
    } else {
      dispatch({ type: 'SET_STREAM_STATUS', status: 'error', error: 'Paste a direct .m3u8 or .mp4 URL.' });
    }
  }, [urlValue, state.sessionId, dispatch]);

  const handleOpenNewGame = useCallback(() => {
    setShowLeaveConfirm(true);
  }, []);

  const handleConfirmLeave = useCallback(async () => {
    setShowLeaveConfirm(false);
    // Flush pending save before resetting
    if (state.sessionId && state.sessionName) {
      await updateSession(state.sessionId, { name: state.sessionName });
    }
    onLeaveSession?.();
    dispatch({ type: 'RESET' });
  }, [state.sessionId, state.sessionName, onLeaveSession, dispatch]);

  const handleDeleteBookmark = useCallback((id: string) => {
    const bookmark = state.bookmarks.find(b => b.id === id);
    if (bookmark?.cloudId) {
      deleteEvent(bookmark.cloudId);
    }
    dispatch({ type: 'REMOVE_BOOKMARK', id });
  }, [dispatch, state.bookmarks]);

  if (state.bookmarks.length === 0) return null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: THEME.surface,
    }}>
      {/* Panel collapse button */}
      {onClose && (
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '4px 6px 0',
          flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              color: THEME.textMuted,
              cursor: 'pointer',
              padding: 4,
              opacity: 0.6,
              borderRadius: 4,
            }}
            title="Collapse panel"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="15" y1="3" x2="15" y2="21" />
              <polyline points="10,8 13,12 10,16" />
            </svg>
          </button>
        </div>
      )}

      {/* Session actions — only for session owner */}
      {isSessionOwner && (
        <div style={{
          padding: '4px 8px 6px',
          borderBottom: `1px solid ${THEME.borderSubtle}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          flexShrink: 0,
        }}>
          <button
            onClick={handleOpenNewGame}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              width: '100%',
              padding: '5px 6px',
              background: THEME.surfaceHover,
              border: `1px solid ${THEME.borderSubtle}`,
              borderRadius: 4,
              color: THEME.secondary,
              fontSize: 11,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Open new game
          </button>

          <button
            onClick={() => {
              setUrlValue(state.streamUrl || '');
              setUrlDialogOpen(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              width: '100%',
              padding: '5px 6px',
              background: 'transparent',
              border: `1px solid ${THEME.borderSubtle}`,
              borderRadius: 4,
              color: THEME.textMuted,
              fontSize: 11,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            Change stream URL
          </button>
        </div>
      )}

      {/* Events header */}
      <div style={{
        padding: '6px 10px',
        borderBottom: `1px solid ${THEME.borderSubtle}`,
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: THEME.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          Events ({state.bookmarks.length})
        </span>
      </div>

      {/* Scrollable bookmark list */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '4px 8px',
      }}>
        {state.bookmarks.map(bookmark => {
          const canEdit = bookmark.ownerId === user?.id || isSessionOwner;
          return (
            <div
              key={bookmark.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 0',
                fontSize: 11,
              }}
            >
              {/* Timestamp pill */}
              <button
                onClick={() => onSeek(bookmark.time)}
                style={{
                  flexShrink: 0,
                  background: THEME.surfaceHover,
                  border: `1px solid ${THEME.borderSubtle}`,
                  borderRadius: 4,
                  padding: '2px 6px',
                  fontSize: 10,
                  fontFamily: 'monospace',
                  fontWeight: 600,
                  color: bookmark.category ? '#3b82f6' : THEME.highlight,
                  cursor: 'pointer',
                  minWidth: 44,
                  textAlign: 'center',
                }}
                title="Jump to this time"
              >
                {formatTime(bookmark.time)}
              </button>

              {/* Category badge */}
              {bookmark.category && (
                <span style={{
                  flexShrink: 0,
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#3b82f6',
                  borderRadius: 3,
                  padding: '1px 5px',
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.3px',
                }}>
                  {BOOKMARK_CATEGORY_LABELS[bookmark.category].short}
                </span>
              )}

              {/* Spacer for standard events, comment field for custom */}
              {bookmark.category ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {/* Creator attribution for category events */}
                  {bookmark.createdByName && bookmark.ownerId !== user?.id && (
                    <span style={{ fontSize: 9, color: THEME.textMuted, opacity: 0.7 }}>
                      by {bookmark.createdByName}
                    </span>
                  )}
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  {editingId === bookmark.id && canEdit ? (
                    <input
                      autoFocus
                      type="text"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={saveEdit}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveEdit();
                        if (e.key === 'Escape') cancelEdit();
                        e.stopPropagation();
                      }}
                      style={{
                        flex: 1,
                        padding: '2px 6px',
                        background: THEME.surfaceRaised,
                        border: `1px solid ${THEME.highlight}`,
                        borderRadius: 3,
                        color: THEME.secondary,
                        fontSize: 11,
                        fontFamily: 'inherit',
                        outline: 'none',
                        minWidth: 0,
                      }}
                      placeholder="Add a note..."
                    />
                  ) : (
                    <span
                      onClick={canEdit ? () => startEditing(bookmark.id, bookmark.comment) : undefined}
                      style={{
                        flex: 1,
                        color: bookmark.comment ? THEME.secondary : THEME.textMuted,
                        cursor: canEdit ? 'text' : 'default',
                        padding: '2px 4px',
                        borderRadius: 3,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontSize: 11,
                      }}
                      title={canEdit ? (bookmark.comment || 'Click to add a note') : bookmark.comment}
                    >
                      {bookmark.comment || (canEdit ? 'Add note...' : '')}
                    </span>
                  )}
                  {/* Creator attribution for custom events */}
                  {bookmark.createdByName && bookmark.ownerId !== user?.id && (
                    <span style={{ fontSize: 9, color: THEME.textMuted, opacity: 0.7, padding: '0 4px' }}>
                      by {bookmark.createdByName}
                    </span>
                  )}
                </div>
              )}

              {/* Delete — only for event owner or session owner */}
              {canEdit && (
                <button
                  onClick={() => handleDeleteBookmark(bookmark.id)}
                  style={{
                    flexShrink: 0,
                    background: 'none',
                    border: 'none',
                    color: THEME.textMuted,
                    cursor: 'pointer',
                    padding: 2,
                    fontSize: 13,
                    lineHeight: 1,
                    opacity: 0.5,
                  }}
                  title="Remove event"
                >
                  &times;
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Keyboard shortcuts */}
      <div style={{
        padding: '6px 8px',
        borderTop: `1px solid ${THEME.borderSubtle}`,
        flexShrink: 0,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
      }}>
        {[
          ['Space', 'Play/Pause'],
          ['I / O', 'Start / End'],
          ['R', 'Record clip'],
          ['M', 'Mark event'],
          ['D', 'Draw'],
          ['Arrows', 'Seek'],
        ].map(([key, label]) => (
          <div key={key} style={{
            fontSize: 10,
            color: THEME.textMuted,
            border: `1px solid ${THEME.borderSubtle}`,
            borderRadius: 4,
            padding: '2px 6px',
            whiteSpace: 'nowrap',
          }}>
            <span style={{ color: THEME.secondary, fontWeight: 600 }}>{key}</span>{' '}{label}
          </div>
        ))}
      </div>

      {/* Leave session confirmation */}
      {showLeaveConfirm && (
        <ConfirmDialog
          message="Leave this game and open a new one?"
          confirmLabel="Leave"
          onConfirm={handleConfirmLeave}
          onCancel={() => setShowLeaveConfirm(false)}
        />
      )}

      {/* Centered URL dialog */}
      {urlDialogOpen && (
        <div
          onClick={() => setUrlDialogOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: THEME.surface,
              border: `1px solid ${THEME.borderSubtle}`,
              borderRadius: 10,
              padding: '20px 24px',
              width: 480,
              maxWidth: '90vw',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span style={{
                fontSize: 14,
                fontWeight: 600,
                color: THEME.secondary,
              }}>
                Change stream URL
              </span>
              <button
                onClick={() => setUrlDialogOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: THEME.textMuted,
                  cursor: 'pointer',
                  padding: 2,
                  fontSize: 18,
                  lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>

            <p style={{
              fontSize: 12,
              color: THEME.textMuted,
              margin: 0,
              lineHeight: 1.4,
            }}>
              Paste a direct .m3u8 stream URL, .mp4 video URL, or a page URL from a supported platform (fotbollplay.se, veo.co).
            </p>

            <input
              autoFocus
              type="text"
              value={urlValue}
              onChange={e => setUrlValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleUrlUpdate();
                if (e.key === 'Escape') setUrlDialogOpen(false);
                e.stopPropagation();
              }}
              placeholder="https://..."
              style={{
                width: '100%',
                padding: '10px 12px',
                background: THEME.surfaceRaised,
                border: `1px solid ${THEME.borderSubtle}`,
                borderRadius: 6,
                color: THEME.secondary,
                fontSize: 13,
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setUrlDialogOpen(false)}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  border: `1px solid ${THEME.borderSubtle}`,
                  borderRadius: 6,
                  color: THEME.textMuted,
                  fontSize: 12,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleUrlUpdate}
                disabled={!urlValue.trim()}
                style={{
                  padding: '8px 16px',
                  background: THEME.highlight,
                  color: '#000',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  opacity: !urlValue.trim() ? 0.5 : 1,
                }}
              >
                Update stream
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
