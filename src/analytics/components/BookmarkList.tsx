import { useState, useCallback } from 'react';
import { useAnalytics } from '../AnalyticsContext';
import { formatTime } from '../utils/time';
import { THEME } from '../../constants/colors';

type Props = {
  onSeek: (time: number) => void;
  onClose?: () => void;
};

export function BookmarkList({ onSeek, onClose }: Props) {
  const { state, dispatch } = useAnalytics();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const startEditing = useCallback((id: string, currentComment: string) => {
    setEditingId(id);
    setEditValue(currentComment);
  }, []);

  const saveEdit = useCallback(() => {
    if (editingId) {
      dispatch({ type: 'UPDATE_BOOKMARK_COMMENT', id: editingId, comment: editValue });
      setEditingId(null);
    }
  }, [editingId, editValue, dispatch]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  if (state.bookmarks.length === 0) return null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: THEME.surface,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
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
          Bookmarks ({state.bookmarks.length})
        </span>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: THEME.textMuted,
              cursor: 'pointer',
              padding: 2,
              fontSize: 14,
              lineHeight: 1,
              opacity: 0.6,
            }}
            title="Close bookmarks panel"
          >
            &times;
          </button>
        )}
      </div>

      {/* Scrollable bookmark list */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '4px 8px',
      }}>
        {state.bookmarks.map(bookmark => (
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
                color: THEME.highlight,
                cursor: 'pointer',
                minWidth: 44,
                textAlign: 'center',
              }}
              title="Jump to this time"
            >
              {formatTime(bookmark.time)}
            </button>

            {/* Comment — inline editable */}
            {editingId === bookmark.id ? (
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
                onClick={() => startEditing(bookmark.id, bookmark.comment)}
                style={{
                  flex: 1,
                  color: bookmark.comment ? THEME.secondary : THEME.textMuted,
                  cursor: 'text',
                  padding: '2px 4px',
                  borderRadius: 3,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 11,
                }}
                title={bookmark.comment || 'Click to add a note'}
              >
                {bookmark.comment || 'Add note...'}
              </span>
            )}

            {/* Delete */}
            <button
              onClick={() => dispatch({ type: 'REMOVE_BOOKMARK', id: bookmark.id })}
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
              title="Remove bookmark"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
