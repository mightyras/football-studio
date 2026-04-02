import { useState, useCallback, useRef, useEffect } from 'react';
import { useAnalytics } from '../AnalyticsContext';
import { formatTime, formatFileSize } from '../utils/time';
import { downloadBlob } from '../utils/download';
import { formatTimestamp } from '../utils/time';
import { deleteClip, updateClipLabel, getClipDownloadUrl } from '../services/analysisService';
import { ConfirmDialog } from './ConfirmDialog';
import { THEME } from '../../constants/colors';

export function SessionClipList() {
  const { state, dispatch } = useAnalytics();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deletingClipId, setDeletingClipId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', updateScrollState); ro.disconnect(); };
  }, [updateScrollState, state.sessionClips.length]);

  const scroll = useCallback((dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
  }, []);

  const startEditing = useCallback((id: string, currentLabel: string) => {
    setEditingId(id);
    setEditValue(currentLabel);
  }, []);

  const saveEdit = useCallback((clipId: string, cloudId?: string) => {
    if (editingId) {
      dispatch({ type: 'UPDATE_CLIP_LABEL', id: clipId, label: editValue });
      if (cloudId) updateClipLabel(cloudId, editValue);
      setEditingId(null);
    }
  }, [editingId, editValue, dispatch]);

  if (state.sessionClips.length === 0) return null;

  return (
    <>
      <style>{`.clip-thumb:hover .clip-hover-label { opacity: 1 !important; }`}</style>
    <div style={{
      padding: '4px 12px 8px',
      position: 'relative',
    }}>
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          style={{
            position: 'absolute',
            left: 4,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 10,
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: THEME.surface,
            border: `1px solid ${THEME.borderSubtle}`,
            color: THEME.secondary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
            padding: 0,
          }}
          aria-label="Scroll left"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          style={{
            position: 'absolute',
            right: 4,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 10,
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: THEME.surface,
            border: `1px solid ${THEME.borderSubtle}`,
            color: THEME.secondary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
            padding: 0,
          }}
          aria-label="Scroll right"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}
      <div
        ref={scrollRef}
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 4,
        }}
      >
        {state.sessionClips.map(clip => (
          <div
            key={clip.id}
            style={{
              flexShrink: 0,
              width: 180,
              background: THEME.surfaceRaised,
              border: `1px solid ${state.selectedClipId === clip.id ? THEME.highlight : THEME.borderSubtle}`,
              borderRadius: 6,
              overflow: 'hidden',
              cursor: 'pointer',
            }}
            onClick={() => dispatch({ type: 'SELECT_CLIP', id: clip.id })}
          >
            {/* Thumbnail with hover label */}
            <div
              className="clip-thumb"
              style={{
                width: '100%',
                height: 100,
                background: '#000',
                position: 'relative',
              }}
            >
              {clip.thumbnailUrl && (
                <img
                  src={clip.thumbnailUrl}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}
              {/* Type badge */}
              <div style={{
                position: 'absolute',
                top: 4,
                left: 4,
                background: clip.type === 'video' ? '#dc2626' : '#2563eb',
                color: '#fff',
                fontSize: 9,
                fontWeight: 600,
                padding: '1px 5px',
                borderRadius: 3,
                textTransform: 'uppercase',
              }}>
                {clip.type === 'video' ? 'VID' : 'IMG'}
              </div>
              {/* Duration for video clips */}
              {clip.type === 'video' && clip.inPoint !== undefined && clip.outPoint !== undefined && (
                <div style={{
                  position: 'absolute',
                  bottom: 4,
                  right: 4,
                  background: 'rgba(0,0,0,0.75)',
                  color: '#fff',
                  fontSize: 10,
                  padding: '1px 4px',
                  borderRadius: 3,
                  zIndex: 1,
                }}>
                  {formatTime(clip.outPoint! - clip.inPoint!)}
                </div>
              )}
              {/* Hover overlay with label */}
              {clip.label && (
                <div
                  className="clip-hover-label"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(0,0,0,0.75)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px 10px',
                    opacity: 0,
                    transition: 'opacity 0.15s',
                    pointerEvents: 'none',
                  }}
                >
                  <span style={{
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 500,
                    textAlign: 'center',
                    lineHeight: 1.4,
                    wordBreak: 'break-word',
                  }}>
                    {clip.label}
                  </span>
                </div>
              )}
            </div>

            {/* Info */}
            <div style={{ padding: '6px 8px' }}>
              {editingId === clip.id ? (
                <input
                  autoFocus
                  type="text"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={() => saveEdit(clip.id, clip.cloudId)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveEdit(clip.id, clip.cloudId);
                    if (e.key === 'Escape') setEditingId(null);
                    e.stopPropagation();
                  }}
                  onClick={e => e.stopPropagation()}
                  style={{
                    width: '100%',
                    padding: '2px 4px',
                    background: THEME.surfaceRaised,
                    border: `1px solid ${THEME.highlight}`,
                    borderRadius: 3,
                    color: THEME.secondary,
                    fontSize: 11,
                    fontFamily: 'inherit',
                    outline: 'none',
                  }}
                />
              ) : (
                <div
                  onClick={e => {
                    e.stopPropagation();
                    startEditing(clip.id, clip.label || '');
                  }}
                  style={{
                    fontSize: 11,
                    color: THEME.secondary,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    cursor: 'text',
                  }}
                  title="Click to edit label"
                >
                  {clip.label || `${clip.type === 'video' ? 'Clip' : 'Screenshot'} @ ${formatTime(clip.timestamp)}`}
                </div>
              )}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 4,
              }}>
                <span style={{ fontSize: 10, color: THEME.textMuted }}>
                  {formatTime(clip.timestamp)}
                  {clip.blob ? ` · ${formatFileSize(clip.blob.size)}` : ''}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {/* Download */}
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const ext = clip.type === 'video' ? 'webm' : 'png';
                      const filename = clip.type === 'video'
                        ? `clip_${formatTimestamp(clip.inPoint ?? 0)}-${formatTimestamp(clip.outPoint ?? 0)}.${ext}`
                        : `screenshot_${formatTimestamp(clip.timestamp)}.${ext}`;
                      if (clip.blob) {
                        downloadBlob(clip.blob, filename);
                      } else if (clip.storagePath) {
                        const url = await getClipDownloadUrl(clip.storagePath);
                        if (url) {
                          const resp = await fetch(url);
                          const blob = await resp.blob();
                          downloadBlob(blob, filename);
                        }
                      }
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: THEME.highlight,
                      cursor: 'pointer',
                      padding: 2,
                      fontSize: 11,
                      fontFamily: 'inherit',
                    }}
                    title="Download"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </button>
                  {/* Delete */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingClipId(clip.id);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: THEME.textMuted,
                      cursor: 'pointer',
                      padding: 2,
                      fontSize: 11,
                      fontFamily: 'inherit',
                      opacity: 0.6,
                    }}
                    title="Delete clip"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {deletingClipId && (() => {
        const clip = state.sessionClips.find(c => c.id === deletingClipId);
        return (
          <ConfirmDialog
            message={`Delete "${clip?.label || 'this clip'}"? This cannot be undone.`}
            onConfirm={() => {
              if (clip?.cloudId) deleteClip(clip.cloudId);
              dispatch({ type: 'REMOVE_SESSION_CLIP', id: deletingClipId });
              setDeletingClipId(null);
            }}
            onCancel={() => setDeletingClipId(null)}
          />
        );
      })()}
    </div>
    </>
  );
}
