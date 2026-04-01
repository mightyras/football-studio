import { useState, useRef, useEffect } from 'react';
import { THEME } from '../../constants/colors';
import { formatTime } from '../utils/time';
import type { SessionClip } from '../types';

type Props = {
  clip: SessionClip;
  onSave: (label: string) => void;
  onDiscard: () => void;
};

/**
 * Modal that shows a captured screenshot or video clip preview
 * with a comment input before saving.
 */
export function CapturePreview({ clip, onSave, onDiscard }: Props) {
  const [label, setLabel] = useState(clip.label || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Auto-focus the input
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Set up video playback for clip previews
  useEffect(() => {
    if (clip.type === 'video' && clip.blob && videoRef.current) {
      const url = URL.createObjectURL(clip.blob);
      videoRef.current.src = url;
      videoRef.current.play().catch(() => {});
      return () => URL.revokeObjectURL(url);
    }
  }, [clip.type, clip.blob]);

  const handleSave = () => {
    onSave(label.trim() || clip.label || '');
  };

  // Use thumbnailUrl (already a blob URL) for screenshots — avoid creating new blob URLs on every render
  const imgUrl = clip.thumbnailUrl;

  return (
    <div
      onClick={onDiscard}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        background: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: THEME.surface,
          borderRadius: 12,
          border: `1px solid ${THEME.borderSubtle}`,
          maxWidth: 640,
          width: '90vw',
          overflow: 'hidden',
        }}
      >
        {/* Preview media */}
        <div style={{
          background: '#000',
          position: 'relative',
        }}>
          {clip.type === 'video' ? (
            <video
              ref={videoRef}
              controls
              style={{
                width: '100%',
                maxHeight: '50vh',
                display: 'block',
              }}
            />
          ) : (
            <img
              src={imgUrl}
              alt="Screenshot preview"
              style={{
                width: '100%',
                maxHeight: '50vh',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          )}

          {/* Type + timestamp badge */}
          <div style={{
            position: 'absolute',
            top: 8,
            left: 8,
            display: 'flex',
            gap: 6,
            alignItems: 'center',
          }}>
            <span style={{
              background: clip.type === 'video' ? '#dc2626' : '#2563eb',
              color: '#fff',
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 4,
              textTransform: 'uppercase',
            }}>
              {clip.type === 'video' ? 'Video clip' : 'Screenshot'}
            </span>
            <span style={{
              background: 'rgba(0,0,0,0.6)',
              color: '#fff',
              fontSize: 11,
              padding: '2px 6px',
              borderRadius: 4,
            }}>
              @ {formatTime(clip.timestamp)}
              {clip.type === 'video' && clip.inPoint !== undefined && clip.outPoint !== undefined && (
                <> ({formatTime(clip.outPoint - clip.inPoint)})</>
              )}
            </span>
          </div>
        </div>

        {/* Comment input + actions */}
        <div style={{ padding: '16px 20px' }}>
          <label style={{
            display: 'block',
            fontSize: 11,
            fontWeight: 600,
            color: THEME.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.3px',
            marginBottom: 6,
          }}>
            Add a comment
          </label>
          <input
            ref={inputRef}
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') onDiscard();
              e.stopPropagation();
            }}
            placeholder={clip.type === 'video' ? 'e.g. Great counter-attack build-up' : 'e.g. Defensive shape at set piece'}
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

          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            marginTop: 14,
          }}>
            <button
              onClick={onDiscard}
              style={{
                padding: '8px 16px',
                background: 'none',
                border: `1px solid ${THEME.borderSubtle}`,
                borderRadius: 6,
                color: THEME.textMuted,
                fontSize: 13,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              Discard
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: '8px 20px',
                background: THEME.highlight,
                border: 'none',
                borderRadius: 6,
                color: '#000',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
