import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useAnalytics } from '../AnalyticsContext';
import { useAuth } from '../../state/AuthContext';
import { detectUrlType, extractUrlMetadata } from '../utils/urlDetector';
import { updateSession, updateEventComment, deleteEvent, getSourceFileUrl, uploadSourceFile, updateSourceFileOrder } from '../services/analysisService';
import { formatTime } from '../utils/time';
import { ConfirmDialog } from './ConfirmDialog';
import { THEME } from '../../constants/colors';
import { BOOKMARK_CATEGORY_LABELS } from '../types';
import { supabase } from '../../lib/supabase';
import type { SourceFileInfo } from '../types';

const MAX_UPLOAD_SIZE = 50 * 1024 * 1024; // 50 MB

type Props = {
  onSeek: (time: number) => void;
  onClose?: () => void;
  onLeaveSession?: () => void;
  autoEditId?: string | null;
};

export function BookmarkList({ onSeek, onClose, onLeaveSession, autoEditId }: Props) {
  const { state, dispatch } = useAnalytics();
  const { user } = useAuth();
  const isSessionOwner = state.sessionOwnerId === user?.id;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Auto-edit a newly created bookmark (e.g. from M key → custom)
  useEffect(() => {
    if (autoEditId && autoEditId !== editingId) {
      setEditingId(autoEditId);
      setEditValue('');
    }
  }, [autoEditId]);

  // In multi-file mode, filter bookmarks to the active source file
  const visibleBookmarks = useMemo(() => {
    if (state.sourceType !== 'uploaded_files' || !state.activeSourceFileId) {
      return state.bookmarks;
    }
    return state.bookmarks.filter(b =>
      !b.sourceFileId || b.sourceFileId === state.activeSourceFileId
    );
  }, [state.bookmarks, state.sourceType, state.activeSourceFileId]);
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

  const hasSourceFiles = state.sourceFiles.length > 1;

  const handleFileSelect = useCallback(async (file: SourceFileInfo) => {
    if (file.id === state.activeSourceFileId) return;

    dispatch({ type: 'SET_ACTIVE_SOURCE_FILE', id: file.id });
    dispatch({ type: 'SET_CURRENT_TIME', time: 0 });
    dispatch({ type: 'SET_IN_POINT', time: null });
    dispatch({ type: 'SET_OUT_POINT', time: null });
    dispatch({ type: 'CLEAR_FREEHAND_ANNOTATIONS' });

    let url: string | null = null;
    if (file.objectUrl) {
      url = file.objectUrl;
    } else if (file.storagePath) {
      url = await getSourceFileUrl(file.storagePath);
    }

    if (url) {
      dispatch({ type: 'SET_RESOLVED_STREAM_URL', url });
      dispatch({ type: 'SET_STREAM_STATUS', status: 'loading' });
    }
  }, [state.activeSourceFileId, dispatch]);

  // ── Drag-to-reorder source files ──
  const [dragFileId, setDragFileId] = useState<string | null>(null);
  const [dragOverFileId, setDragOverFileId] = useState<string | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, fileId: string) => {
    setDragFileId(fileId);
    e.dataTransfer.effectAllowed = 'move';
    // Required for Firefox
    e.dataTransfer.setData('text/plain', fileId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, fileId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (fileId !== dragFileId) {
      setDragOverFileId(fileId);
    }
  }, [dragFileId]);

  const handleDragEnd = useCallback(() => {
    setDragFileId(null);
    setDragOverFileId(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetFileId: string) => {
    e.preventDefault();
    if (!dragFileId || dragFileId === targetFileId) {
      handleDragEnd();
      return;
    }

    const files = [...state.sourceFiles];
    const dragIndex = files.findIndex(f => f.id === dragFileId);
    const targetIndex = files.findIndex(f => f.id === targetFileId);
    if (dragIndex === -1 || targetIndex === -1) {
      handleDragEnd();
      return;
    }

    // Move dragged item to target position
    const [moved] = files.splice(dragIndex, 1);
    files.splice(targetIndex, 0, moved);

    // Update sortOrder values
    const reordered = files.map((f, i) => ({ ...f, sortOrder: i }));
    dispatch({ type: 'SET_SOURCE_FILES', files: reordered });

    // Persist to DB for uploaded files
    if (state.sessionId && state.sourceType === 'uploaded_files') {
      const updates = reordered
        .filter(f => f.storagePath) // only uploaded files have storagePath
        .map(f => ({ id: f.id, sortOrder: f.sortOrder }));
      if (updates.length > 0) {
        updateSourceFileOrder(updates);
      }
    }

    handleDragEnd();
  }, [dragFileId, state.sourceFiles, state.sessionId, state.sourceType, dispatch, handleDragEnd]);

  // Add more files to the current session
  const addFileInputRef = useRef<HTMLInputElement>(null);
  const [addingFiles, setAddingFiles] = useState(false);

  const handleAddFiles = useCallback(async (files: File[]) => {
    if (!state.sessionId || files.length === 0) return;
    setAddingFiles(true);

    const currentCount = state.sourceFiles.length;
    const newFiles: SourceFileInfo[] = [];

    // Check if any files are too large — if so, keep them local
    const hasOversized = files.some(f => f.size > MAX_UPLOAD_SIZE);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const sortOrder = currentCount + i;

      if (!hasOversized && file.size <= MAX_UPLOAD_SIZE) {
        const sf = await uploadSourceFile(state.sessionId, file, sortOrder);
        if (sf) {
          newFiles.push({
            id: sf.id,
            fileName: sf.file_name,
            storagePath: sf.storage_path,
            fileSize: sf.file_size ?? undefined,
            sortOrder: sf.sort_order,
          });
        }
      } else {
        const objectUrl = URL.createObjectURL(file);
        newFiles.push({
          id: crypto.randomUUID(),
          fileName: file.name,
          objectUrl,
          fileSize: file.size,
          sortOrder,
        });
      }
    }

    if (newFiles.length > 0) {
      dispatch({ type: 'SET_SOURCE_FILES', files: [...state.sourceFiles, ...newFiles] });
      // If this was a single local-file session, upgrade the source type
      if (state.sourceType === 'local_file' || state.sourceType === 'stream') {
        dispatch({ type: 'SET_SOURCE_TYPE', sourceType: hasOversized ? 'local_file' : 'uploaded_files' });
      }
    }

    setAddingFiles(false);
  }, [state.sessionId, state.sourceFiles, state.sourceType, dispatch]);

  const canAddFiles = state.sourceType !== 'stream' && state.sessionId;

  if (visibleBookmarks.length === 0 && !hasSourceFiles && !canAddFiles) return null;

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

      {/* Source files section — shown for non-stream sessions */}
      {(hasSourceFiles || canAddFiles) && (
        <>
          <div style={{
            padding: '6px 10px',
            borderBottom: state.sourceFiles.length > 0 ? 'none' : `1px solid ${THEME.borderSubtle}`,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: THEME.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Files {state.sourceFiles.length > 0 ? `(${state.sourceFiles.length})` : ''}
            </span>
            <input
              ref={addFileInputRef}
              type="file"
              accept="video/*"
              multiple
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length > 0) handleAddFiles(Array.from(files));
                e.target.value = '';
              }}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => addFileInputRef.current?.click()}
              disabled={addingFiles}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                background: 'none',
                border: 'none',
                color: THEME.textMuted,
                cursor: addingFiles ? 'wait' : 'pointer',
                padding: '0 2px',
                fontSize: 10,
                fontFamily: 'inherit',
                opacity: 0.7,
              }}
              title="Add more files"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {addingFiles ? 'Adding...' : 'Add'}
            </button>
          </div>
          {state.sourceFiles.length > 0 && (
          <div style={{
            padding: '4px 8px',
            borderBottom: `1px solid ${THEME.borderSubtle}`,
            flexShrink: 0,
          }}>
            {state.sourceFiles.map((file) => {
              const isActive = file.id === state.activeSourceFileId;
              const isDragging = file.id === dragFileId;
              const isDragOver = file.id === dragOverFileId && dragFileId !== file.id;
              const shortName = file.fileName.replace(/\.[^.]+$/, '');
              return (
                <div
                  key={file.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, file.id)}
                  onDragOver={(e) => handleDragOver(e, file.id)}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDrop(e, file.id)}
                  onClick={() => handleFileSelect(file)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    width: '100%',
                    padding: '5px 4px',
                    background: isActive ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                    border: isActive ? '1px solid rgba(139, 92, 246, 0.3)' : `1px solid transparent`,
                    borderTop: isDragOver ? '2px solid rgba(139, 92, 246, 0.7)' : '2px solid transparent',
                    borderRadius: 4,
                    color: isActive ? '#c4b5fd' : THEME.secondary,
                    fontSize: 11,
                    fontWeight: isActive ? 600 : 400,
                    cursor: 'grab',
                    textAlign: 'left' as const,
                    marginBottom: 2,
                    opacity: isDragging ? 0.4 : 1,
                    transition: isDragging ? 'none' : 'border-top 0.1s',
                  }}
                >
                  {/* Drag handle */}
                  <span style={{
                    flexShrink: 0,
                    color: THEME.textMuted,
                    opacity: 0.4,
                    fontSize: 10,
                    lineHeight: 1,
                    cursor: 'grab',
                    userSelect: 'none',
                  }}>
                    ⠿
                  </span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    {isActive ? (
                      <polygon points="5,3 19,12 5,21" fill="currentColor" />
                    ) : (
                      <polygon points="5,3 19,12 5,21" />
                    )}
                  </svg>
                  <span style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                    flex: 1,
                  }}>
                    {shortName}
                  </span>
                  {file.fileSize && (
                    <span style={{
                      flexShrink: 0,
                      fontSize: 9,
                      color: THEME.textMuted,
                      opacity: 0.7,
                    }}>
                      {formatFileSize(file.fileSize)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </>
      )}

      {/* Events header */}
      {visibleBookmarks.length > 0 && (
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
          Events ({visibleBookmarks.length})
        </span>
      </div>
      )}

      {/* Scrollable bookmark list */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '4px 8px',
      }}>
        {visibleBookmarks.map(bookmark => {
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
                  color: bookmark.category === 'goal'
                    ? '#ffffff'
                    : bookmark.category ? '#3b82f6' : THEME.highlight,
                  cursor: 'pointer',
                  minWidth: 44,
                  textAlign: 'center',
                }}
                title="Jump to this time"
              >
                {formatTime(bookmark.time)}
              </button>

              {/* Category badge */}
              {bookmark.category && (() => {
                const isGoal = bookmark.category === 'goal';
                return (
                  <span style={{
                    flexShrink: 0,
                    background: isGoal ? 'rgba(255, 255, 255, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                    color: isGoal ? '#ffffff' : '#3b82f6',
                    borderRadius: 3,
                    padding: '1px 5px',
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.3px',
                  }}>
                    {isGoal ? 'GOAL' : (BOOKMARK_CATEGORY_LABELS[bookmark.category as keyof typeof BOOKMARK_CATEGORY_LABELS]?.short ?? bookmark.category)}
                  </span>
                );
              })()}

              {/* Spacer for standard events, comment field for custom/goals */}
              {bookmark.category && bookmark.category !== 'goal' ? (
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
