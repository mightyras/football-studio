import type { ZoomPreset, PitchRotation } from '../../types';
import { useThemeColors } from '../../hooks/useThemeColors';
import { hexToRgba } from '../../utils/colorUtils';

interface ZoomControlsProps {
  zoomLevel: number;
  activePreset: ZoomPreset;
  rotation: PitchRotation;
  onSetPreset: (preset: ZoomPreset) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onRotateCW: () => void;
}

export function ZoomControls({
  zoomLevel,
  activePreset,
  rotation,
  onSetPreset,
  onZoomIn,
  onZoomOut,
  onReset,
  onRotateCW,
}: ZoomControlsProps) {
  const theme = useThemeColors();

  const btnBase: React.CSSProperties = {
    border: '1px solid transparent',
    borderRadius: 4,
    background: 'transparent',
    color: theme.textMuted,
    cursor: 'pointer',
    padding: '3px 8px',
    fontSize: 11,
    fontFamily: 'inherit',
    transition: 'all 0.15s',
    lineHeight: '18px',
  };

  const separatorStyle: React.CSSProperties = {
    width: 1,
    height: 18,
    background: theme.borderSubtle,
    margin: '0 4px',
    flexShrink: 0,
  };

  const btnActive: React.CSSProperties = {
    ...btnBase,
    border: `1px solid ${theme.highlight}`,
    background: hexToRgba(theme.highlight, 0.15),
    color: theme.highlight,
  };
  const zoomPct = Math.round(zoomLevel * 100);
  const isZoomed = zoomLevel > 1;
  const isLandscape = rotation === 1 || rotation === 3;
  const firstHalfLabel = isLandscape ? 'Left ½' : 'Top ½';
  const secondHalfLabel = isLandscape ? 'Right ½' : 'Bottom ½';

  return (
    <div
      data-tour="zoom-controls"
      style={{
        position: 'absolute',
        bottom: 8,
        right: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        background: hexToRgba(theme.primary, 0.9),
        borderRadius: 6,
        padding: '3px 4px',
        border: `1px solid ${theme.border}`,
        backdropFilter: 'blur(8px)',
        pointerEvents: 'auto',
        userSelect: 'none',
      }}
      onPointerDown={e => e.stopPropagation()}
    >
      <button
        style={activePreset === 'top-half' ? btnActive : btnBase}
        onClick={() => onSetPreset(activePreset === 'top-half' ? 'full' : 'top-half')}
        title={`Zoom to ${firstHalfLabel.toLowerCase()} (2)`}
        onMouseEnter={e => {
          if (activePreset !== 'top-half') {
            e.currentTarget.style.background = theme.surfaceHover;
            e.currentTarget.style.color = theme.secondary;
          }
        }}
        onMouseLeave={e => {
          if (activePreset !== 'top-half') {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = theme.textMuted;
          }
        }}
      >
        {firstHalfLabel}
      </button>
      <button
        style={activePreset === 'bottom-half' ? btnActive : btnBase}
        onClick={() => onSetPreset(activePreset === 'bottom-half' ? 'full' : 'bottom-half')}
        title={`Zoom to ${secondHalfLabel.toLowerCase()} (3)`}
        onMouseEnter={e => {
          if (activePreset !== 'bottom-half') {
            e.currentTarget.style.background = theme.surfaceHover;
            e.currentTarget.style.color = theme.secondary;
          }
        }}
        onMouseLeave={e => {
          if (activePreset !== 'bottom-half') {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = theme.textMuted;
          }
        }}
      >
        {secondHalfLabel}
      </button>

      <div style={separatorStyle} />

      <button
        style={rotation !== 0
          ? { ...btnBase, border: `1px solid ${theme.highlight}`, background: hexToRgba(theme.highlight, 0.15), color: theme.highlight }
          : btnBase
        }
        onClick={onRotateCW}
        title="Rotate pitch 90° clockwise (Shift+R)"
        onMouseEnter={e => {
          if (rotation === 0) {
            e.currentTarget.style.background = theme.surfaceHover;
            e.currentTarget.style.color = theme.secondary;
          }
        }}
        onMouseLeave={e => {
          if (rotation === 0) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = theme.textMuted;
          }
        }}
      >
        ↻
      </button>

      <div style={separatorStyle} />

      <button
        style={{ ...btnBase, padding: '3px 6px', fontSize: 13, fontWeight: 600 }}
        onClick={onZoomOut}
        title="Zoom out (Cmd -)"
        onMouseEnter={e => { e.currentTarget.style.background = theme.surfaceHover; e.currentTarget.style.color = theme.secondary; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = theme.textMuted; }}
      >
        -
      </button>

      <span
        style={{
          color: theme.textMuted,
          fontSize: 11,
          minWidth: 36,
          textAlign: 'center',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {zoomPct}%
      </span>

      <button
        style={{ ...btnBase, padding: '3px 6px', fontSize: 13, fontWeight: 600 }}
        onClick={onZoomIn}
        title="Zoom in (Cmd +)"
        onMouseEnter={e => { e.currentTarget.style.background = theme.surfaceHover; e.currentTarget.style.color = theme.secondary; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = theme.textMuted; }}
      >
        +
      </button>

      {isZoomed && (
        <>
          <div style={separatorStyle} />
          <button
            style={btnBase}
            onClick={onReset}
            title="Reset zoom (0)"
            onMouseEnter={e => { e.currentTarget.style.background = theme.surfaceHover; e.currentTarget.style.color = theme.secondary; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = theme.textMuted; }}
          >
            Reset
          </button>
        </>
      )}
    </div>
  );
}
