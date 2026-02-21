import { useCallback, useRef, useState } from 'react';
import type { AnimationSequence, Keyframe } from '../../types';
import { useAppState } from '../../state/AppStateContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import { hexToRgba } from '../../utils/colorUtils';

// ── Mini pitch preview (simplified dot rendering) ──

function MiniPitchPreview({ keyframe, teamAColor, teamBColor }: {
  keyframe: Keyframe;
  teamAColor: string;
  teamBColor: string;
}) {
  const width = 80;
  const height = 52;
  // Pitch world is 105 x 68
  const scaleX = width / 68;  // world Y → screen X (axis swap)
  const scaleY = height / 105; // world X → screen Y

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {/* Pitch background */}
      <rect width={width} height={height} rx={2} fill="#1a472a" />
      {/* Center line */}
      <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} />
      {/* Center circle */}
      <circle cx={width / 2} cy={height / 2} r={4} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} />
      {/* Players */}
      {keyframe.players.map(p => {
        const sx = p.y * scaleX; // world Y → screen X
        const sy = p.x * scaleY; // world X → screen Y
        const color = p.team === 'A' ? teamAColor : teamBColor;
        return (
          <circle key={p.id} cx={sx} cy={sy} r={2.5} fill={color} stroke="rgba(0,0,0,0.4)" strokeWidth={0.5} />
        );
      })}
      {/* Ball */}
      <circle
        cx={keyframe.ball.y * scaleX}
        cy={keyframe.ball.x * scaleY}
        r={2}
        fill="white"
        stroke="rgba(0,0,0,0.3)"
        strokeWidth={0.5}
      />
    </svg>
  );
}

// ── Duration editor ──

function DurationEditor({ value, onChange }: { value: number; onChange: (ms: number) => void }) {
  const theme = useThemeColors();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const displayValue = (value / 1000).toFixed(1) + 's';

  if (!editing) {
    return (
      <span
        onClick={() => {
          setEditing(true);
          setText((value / 1000).toFixed(1));
          setTimeout(() => inputRef.current?.select(), 10);
        }}
        style={{
          cursor: 'pointer',
          fontSize: 10,
          color: theme.textMuted,
          padding: '1px 4px',
          borderRadius: 2,
        }}
        title="Click to edit duration"
      >
        {displayValue}
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      autoFocus
      value={text}
      onChange={e => setText(e.target.value)}
      onBlur={() => {
        const parsed = parseFloat(text);
        if (!isNaN(parsed) && parsed > 0) {
          onChange(Math.round(parsed * 1000));
        }
        setEditing(false);
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        }
        if (e.key === 'Escape') {
          setEditing(false);
        }
      }}
      style={{
        width: 32,
        fontSize: 10,
        background: theme.border,
        border: `1px solid ${theme.textSubtle}`,
        borderRadius: 2,
        color: theme.secondary,
        textAlign: 'center',
        outline: 'none',
        padding: '1px 2px',
      }}
    />
  );
}

// ── Main Component ──

interface KeyframeStripProps {
  onExport?: () => void;
}

export function KeyframeStrip({ onExport }: KeyframeStripProps = {}) {
  const { state, dispatch } = useAppState();
  const theme = useThemeColors();
  const seq = state.animationSequence;
  const keyframes = seq?.keyframes ?? [];

  const handleCapture = () => {
    dispatch({ type: 'CAPTURE_KEYFRAME' });
  };

  const handleSelect = (index: number) => {
    dispatch({ type: 'SELECT_KEYFRAME', index });
  };

  const handleDelete = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({ type: 'DELETE_KEYFRAME', index });
  };

  const handleDurationChange = (index: number, durationMs: number) => {
    dispatch({ type: 'SET_KEYFRAME_DURATION', index, durationMs });
  };

  const handleUpdate = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({ type: 'UPDATE_KEYFRAME', index });
  };

  const handleClearAll = () => {
    dispatch({ type: 'CLEAR_ANIMATION' });
  };

  const handleSave = useCallback(() => {
    if (!seq) return;
    const json = JSON.stringify(seq, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${seq.name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'animation'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [seq]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLoad = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as AnimationSequence;
        if (data && data.keyframes && Array.isArray(data.keyframes)) {
          dispatch({ type: 'LOAD_ANIMATION', sequence: data });
        }
      } catch {
        // Invalid file — silently ignore
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be loaded again
    e.target.value = '';
  }, [dispatch]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        background: theme.inputBg,
        borderTop: `1px solid ${theme.border}`,
        overflowX: 'auto',
        minHeight: 80,
      }}
    >
      {keyframes.map((kf, i) => {
        const isActive = state.activeKeyframeIndex === i;

        return (
          <div
            key={kf.id}
            onClick={() => handleSelect(i)}
            style={{
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: 3,
              borderRadius: 4,
              border: isActive ? `2px solid ${theme.highlight}` : `2px solid ${theme.borderSubtle}`,
              background: isActive ? hexToRgba(theme.highlight, 0.08) : theme.border,
              cursor: 'pointer',
              transition: 'border-color 0.15s',
              position: 'relative',
            }}
          >
            {/* Mini pitch preview */}
            <MiniPitchPreview
              keyframe={kf}
              teamAColor={state.teamAColor}
              teamBColor={state.teamBColor}
            />

            {/* Duration and label row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 9, color: theme.textSubtle, fontWeight: 500 }}>
                {i + 1}
              </span>
              <DurationEditor
                value={kf.durationMs}
                onChange={ms => handleDurationChange(i, ms)}
              />
            </div>

            {/* Label (small) */}
            {kf.label && (
              <span style={{
                fontSize: 9,
                color: theme.textMuted,
                maxWidth: 72,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {kf.label}
              </span>
            )}

            {/* Action buttons (visible on active) */}
            {isActive && (
              <div style={{
                position: 'absolute',
                top: -6,
                right: -6,
                display: 'flex',
                gap: 2,
              }}>
                {/* Update button */}
                <button
                  onClick={e => handleUpdate(i, e)}
                  title="Update keyframe with current canvas"
                  style={{
                    width: 16,
                    height: 16,
                    fontSize: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#1e40af',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    padding: 0,
                    lineHeight: 1,
                  }}
                >
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </button>
                {/* Delete button */}
                <button
                  onClick={e => handleDelete(i, e)}
                  title="Delete keyframe"
                  style={{
                    width: 16,
                    height: 16,
                    fontSize: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    padding: 0,
                    lineHeight: 1,
                  }}
                >
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Capture new keyframe button */}
      <button
        onClick={handleCapture}
        title="Capture keyframe from current canvas"
        style={{
          flexShrink: 0,
          width: 80,
          height: 64,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          border: `2px dashed ${theme.textSubtle}`,
          borderRadius: 4,
          background: 'transparent',
          color: theme.textSubtle,
          cursor: 'pointer',
          transition: 'all 0.15s',
          fontSize: 11,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = theme.highlight;
          e.currentTarget.style.color = theme.highlight;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = theme.textSubtle;
          e.currentTarget.style.color = theme.textSubtle;
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
        <span>Capture</span>
      </button>

      {/* Spacer pushes action buttons to right */}
      <div style={{ flex: 1, minWidth: 8 }} />

      {/* Action buttons: Save, Load, Clear */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
        {/* Save */}
        <button
          onClick={handleSave}
          disabled={!seq || keyframes.length === 0}
          title="Save animation to file"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            fontSize: 11,
            fontWeight: 500,
            background: 'transparent',
            border: `1px solid ${theme.borderSubtle}`,
            borderRadius: 4,
            color: seq && keyframes.length > 0 ? theme.textMuted : theme.textSubtle,
            cursor: seq && keyframes.length > 0 ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => {
            if (seq && keyframes.length > 0) {
              e.currentTarget.style.borderColor = theme.highlight;
              e.currentTarget.style.color = theme.highlight;
            }
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = theme.borderSubtle;
            e.currentTarget.style.color = seq && keyframes.length > 0 ? theme.textMuted : theme.textSubtle;
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          Save
        </button>

        {/* Load */}
        <button
          onClick={handleLoad}
          title="Load animation from file"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            fontSize: 11,
            fontWeight: 500,
            background: 'transparent',
            border: `1px solid ${theme.borderSubtle}`,
            borderRadius: 4,
            color: theme.textMuted,
            cursor: 'pointer',
            transition: 'all 0.15s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = theme.highlight;
            e.currentTarget.style.color = theme.highlight;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = theme.borderSubtle;
            e.currentTarget.style.color = theme.textMuted;
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          Load
        </button>

        {/* Export */}
        {keyframes.length >= 2 && (
          <button
            onClick={onExport}
            title="Export animation as video"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 500,
              background: 'transparent',
              border: `1px solid ${theme.borderSubtle}`,
              borderRadius: 4,
              color: theme.textMuted,
              cursor: 'pointer',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = theme.highlight;
              e.currentTarget.style.color = theme.highlight;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = theme.borderSubtle;
              e.currentTarget.style.color = theme.textMuted;
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export
          </button>
        )}

        {/* Clear All */}
        {keyframes.length > 0 && (
          <button
            onClick={handleClearAll}
            title="Clear all keyframes"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 500,
              background: 'transparent',
              border: `1px solid ${theme.borderSubtle}`,
              borderRadius: 4,
              color: '#ef4444',
              cursor: 'pointer',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#ef4444';
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = theme.borderSubtle;
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Clear
          </button>
        )}
      </div>

      {/* Hidden file input for Load */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
}
