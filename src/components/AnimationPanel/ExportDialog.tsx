import { useState } from 'react';
import { useThemeColors } from '../../hooks/useThemeColors';
import { hexToRgba } from '../../utils/colorUtils';
import type { ExportOptions } from '../../animation/exportController';

const RESOLUTIONS = [
  { label: '720p (1280×720)', width: 1280, height: 720 },
  { label: '1080p (1920×1080)', width: 1920, height: 1080 },
];

const FPS_OPTIONS = [24, 30, 60];

interface ExportDialogProps {
  onExport: (options: ExportOptions) => void;
  onCancel: () => void;
  exporting: boolean;
  progress: number; // 0..1
}

export function ExportDialog({ onExport, onCancel, exporting, progress }: ExportDialogProps) {
  const theme = useThemeColors();
  const [resIndex, setResIndex] = useState(0);
  const [fps, setFps] = useState(30);

  const handleExport = () => {
    const res = RESOLUTIONS[resIndex];
    onExport({ fps, width: res.width, height: res.height });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        zIndex: 1000,
      }}
      onClick={e => {
        if (e.target === e.currentTarget && !exporting) onCancel();
      }}
    >
      <div
        style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 8,
          padding: '20px 24px',
          minWidth: 320,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>
          Export Animation
        </h3>

        {/* Resolution */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
            Resolution
          </label>
          <select
            value={resIndex}
            onChange={e => setResIndex(Number(e.target.value))}
            disabled={exporting}
            style={{
              width: '100%',
              padding: '6px 8px',
              fontSize: 12,
              background: '#0f172a',
              border: '1px solid #475569',
              borderRadius: 4,
              color: '#e2e8f0',
              outline: 'none',
            }}
          >
            {RESOLUTIONS.map((res, i) => (
              <option key={i} value={i}>{res.label}</option>
            ))}
          </select>
        </div>

        {/* FPS */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
            Frame Rate
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            {FPS_OPTIONS.map(f => (
              <button
                key={f}
                onClick={() => setFps(f)}
                disabled={exporting}
                style={{
                  flex: 1,
                  padding: '5px 0',
                  fontSize: 12,
                  fontWeight: fps === f ? 600 : 400,
                  background: fps === f ? hexToRgba(theme.accent, 0.15) : '#0f172a',
                  border: fps === f ? `1px solid ${theme.accent}` : '1px solid #475569',
                  borderRadius: 4,
                  color: fps === f ? theme.accent : '#94a3b8',
                  cursor: exporting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {f}fps
              </button>
            ))}
          </div>
        </div>

        {/* Format */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
            Format
          </label>
          <span style={{ fontSize: 12, color: '#64748b' }}>WebM (VP9)</span>
        </div>

        {/* Progress bar */}
        {exporting && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>Exporting...</span>
              <span style={{ fontSize: 11, color: theme.accent }}>{Math.round(progress * 100)}%</span>
            </div>
            <div style={{
              height: 4,
              background: '#334155',
              borderRadius: 2,
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${progress * 100}%`,
                background: theme.accent,
                borderRadius: 2,
                transition: 'width 0.1s',
              }} />
            </div>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              background: 'transparent',
              border: '1px solid #475569',
              borderRadius: 4,
              color: '#94a3b8',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {exporting ? 'Cancel' : 'Close'}
          </button>
          {!exporting && (
            <button
              onClick={handleExport}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 600,
                background: theme.accent,
                border: 'none',
                borderRadius: 4,
                color: '#111827',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              Export
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
