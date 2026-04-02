import { useEffect, useRef, useCallback, useState } from 'react';
import { useAnalytics } from '../AnalyticsContext';
import { formatTime } from '../utils/time';
import { downloadBlob } from '../utils/download';
import { formatTimestamp } from '../utils/time';
import { getClipDownloadUrl, deleteClip, updateClipLabel } from '../services/analysisService';
import { ConfirmDialog } from './ConfirmDialog';
import { THEME } from '../../constants/colors';

/**
 * Fullscreen overlay for viewing a selected clip (video or screenshot).
 * Renders when selectedClipId is set. Escape or clicking backdrop closes it.
 */
export function ClipViewer() {
  const { state, dispatch } = useAnalytics();
  const videoRef = useRef<HTMLVideoElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelValue, setLabelValue] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const clip = state.sessionClips.find(c => c.id === state.selectedClipId) ?? null;

  const saveLabel = useCallback(() => {
    if (!clip) return;
    const trimmed = labelValue.trim();
    if (trimmed && trimmed !== clip.label) {
      dispatch({ type: 'UPDATE_CLIP_LABEL', id: clip.id, label: trimmed });
      if (clip.cloudId) updateClipLabel(clip.cloudId, trimmed);
    }
    setEditingLabel(false);
  }, [clip, labelValue, dispatch]);

  // Close viewer
  const close = useCallback(() => {
    dispatch({ type: 'SELECT_CLIP', id: null });
    setSignedUrl(null);
    setMediaError(null);
  }, [dispatch]);

  // Navigate to next/previous clip
  const navigate = useCallback((dir: 1 | -1) => {
    if (!clip) return;
    const idx = state.sessionClips.findIndex(c => c.id === clip.id);
    const next = state.sessionClips[idx + dir];
    if (next) {
      setSignedUrl(null);
      setMediaError(null);
      dispatch({ type: 'SELECT_CLIP', id: next.id });
    }
  }, [clip, state.sessionClips, dispatch]);

  // Keyboard: Escape, Left, Right
  useEffect(() => {
    if (!clip) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { navigate(-1); e.preventDefault(); }
      if (e.key === 'ArrowRight') { navigate(1); e.preventDefault(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [clip, close, navigate]);

  // Load media URL: from local blob or from Supabase signed URL
  useEffect(() => {
    if (!clip) return;

    // Local blob available — use it directly
    if (clip.blob) {
      const url = URL.createObjectURL(clip.blob);
      blobUrlRef.current = url;
      setSignedUrl(null);
      if (clip.type === 'video' && videoRef.current) {
        videoRef.current.src = url;
        videoRef.current.play().catch(() => {});
      }
      return () => {
        URL.revokeObjectURL(url);
        blobUrlRef.current = null;
      };
    }

    // Persisted clip — fetch signed URL from Supabase Storage
    if (clip.storagePath) {
      let cancelled = false;
      setLoadingMedia(true);
      setMediaError(null);
      getClipDownloadUrl(clip.storagePath).then(url => {
        if (cancelled) return;
        if (!url) {
          setLoadingMedia(false);
          setMediaError('Could not load clip. The file may have been deleted or your session may have expired.');
          return;
        }
        setSignedUrl(url);
        setLoadingMedia(false);
        if (clip.type === 'video' && videoRef.current) {
          videoRef.current.src = url;
          videoRef.current.play().catch(() => {});
        }
      });
      return () => { cancelled = true; };
    }
  }, [clip?.id, clip?.type, clip?.blob, clip?.storagePath]);

  if (!clip) return null;

  const idx = state.sessionClips.findIndex(c => c.id === clip.id);
  const hasPrev = idx > 0;
  const hasNext = idx < state.sessionClips.length - 1;

  const handleDownload = async () => {
    if (clip.blob) {
      const ext = clip.type === 'video' ? 'webm' : 'png';
      const filename = clip.type === 'video'
        ? `clip_${formatTimestamp(clip.inPoint ?? 0)}-${formatTimestamp(clip.outPoint ?? 0)}.${ext}`
        : `screenshot_${formatTimestamp(clip.timestamp)}.${ext}`;
      downloadBlob(clip.blob, filename);
    } else if (clip.storagePath) {
      // For persisted clips, open the signed URL in a new tab
      const url = signedUrl || await getClipDownloadUrl(clip.storagePath);
      if (url) window.open(url, '_blank');
    }
  };

  // Determine image URL for screenshot display (use blobUrlRef to avoid creating new URLs on every render)
  const imgUrl = blobUrlRef.current || signedUrl || clip.thumbnailUrl;

  return (
    <div
      onClick={close}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        background: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Header bar */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1,
        }}
      >
        {/* Clip info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            background: clip.type === 'video' ? '#dc2626' : '#2563eb',
            color: '#fff',
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 4,
            textTransform: 'uppercase',
          }}>
            {clip.type === 'video' ? 'Video' : 'Image'}
          </span>
          {editingLabel ? (
            <input
              autoFocus
              type="text"
              value={labelValue}
              onChange={e => setLabelValue(e.target.value)}
              onBlur={saveLabel}
              onKeyDown={e => {
                if (e.key === 'Enter') saveLabel();
                if (e.key === 'Escape') setEditingLabel(false);
                e.stopPropagation();
              }}
              onClick={e => e.stopPropagation()}
              style={{
                padding: '2px 8px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 4,
                color: '#fff',
                fontSize: 13,
                fontWeight: 500,
                fontFamily: 'inherit',
                outline: 'none',
                minWidth: 150,
              }}
            />
          ) : (
            <span
              onClick={(e) => {
                e.stopPropagation();
                setLabelValue(clip.label || '');
                setEditingLabel(true);
              }}
              style={{ color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'text' }}
              title="Click to edit label"
            >
              {clip.label || `${clip.type === 'video' ? 'Clip' : 'Screenshot'} @ ${formatTime(clip.timestamp)}`}
            </span>
          )}
          {clip.type === 'video' && clip.inPoint !== undefined && clip.outPoint !== undefined && (
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
              {formatTime(clip.outPoint - clip.inPoint)}
            </span>
          )}
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
            {idx + 1} / {state.sessionClips.length}
          </span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleDownload}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 6,
              color: '#fff',
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteConfirm(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(220, 38, 38, 0.2)',
              border: '1px solid rgba(220, 38, 38, 0.4)',
              borderRadius: 6,
              color: '#ef4444',
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Delete
          </button>
          <button
            onClick={close}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.6)',
              cursor: 'pointer',
              padding: 4,
              fontSize: 24,
              lineHeight: 1,
            }}
            title="Close (Esc)"
          >
            &times;
          </button>
        </div>
      </div>

      {/* Media content */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '90vw',
          maxHeight: '80vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {mediaError ? (
          <div style={{ color: '#ef4444', fontSize: 14, textAlign: 'center', padding: 24 }}>{mediaError}</div>
        ) : loadingMedia ? (
          <div style={{ color: THEME.textMuted, fontSize: 14 }}>Loading media...</div>
        ) : clip.type === 'video' ? (
          <video
            ref={videoRef}
            src={blobUrlRef.current || signedUrl || undefined}
            controls
            autoPlay
            style={{
              maxWidth: '90vw',
              maxHeight: '80vh',
              borderRadius: 4,
              background: '#000',
            }}
          />
        ) : (
          <img
            src={imgUrl}
            alt={clip.label || 'Screenshot'}
            style={{
              maxWidth: '90vw',
              maxHeight: '80vh',
              borderRadius: 4,
              background: '#000',
              objectFit: 'contain',
            }}
          />
        )}
      </div>

      {/* Navigation arrows */}
      {hasPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(-1); }}
          style={{
            position: 'absolute',
            left: 16,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 8,
            color: '#fff',
            cursor: 'pointer',
            width: 44,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
          }}
          title="Previous (←)"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}
      {hasNext && (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(1); }}
          style={{
            position: 'absolute',
            right: 16,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 8,
            color: '#fff',
            cursor: 'pointer',
            width: 44,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
          }}
          title="Next (→)"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}

      {/* Bottom hint */}
      <div style={{
        position: 'absolute',
        bottom: 16,
        color: 'rgba(255,255,255,0.3)',
        fontSize: 11,
      }}>
        Esc: Close &nbsp; ← →: Navigate clips
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <ConfirmDialog
          message={`Delete "${clip.label || 'this clip'}"? This cannot be undone.`}
          onConfirm={() => {
            if (clip.cloudId) deleteClip(clip.cloudId);
            dispatch({ type: 'REMOVE_SESSION_CLIP', id: clip.id });
            setShowDeleteConfirm(false);
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
