import { useState, useEffect } from 'react';
import { useThemeColors } from '../../hooks/useThemeColors';
import { contrastRatio } from '../../utils/colorDerivation';

// ── Palette presets ──

const JERSEY_COLORS = [
  '#ef4444', '#3b82f6', '#22c55e', '#3F8E51', '#eab308',
  '#ffffff', '#1a1a1a', '#f97316', '#a855f7', '#06b6d4', '#ec4899',
];

const DARK_BG_COLORS = [
  '#0a0e1a', '#0d1117', '#111827', '#1a1a2e', '#0f172a',
  '#18181b', '#1c1917', '#1e1b4b', '#0c0a09', '#052e16', '#172554',
];

const LIGHT_TEXT_COLORS = [
  '#e2e8f0', '#f8fafc', '#f1f5f9', '#cbd5e1', '#d1d5db',
  '#fbbf24', '#f9fafb', '#e5e7eb', '#c4b5fd', '#a7f3d0', '#bfdbfe',
];

const HIGHLIGHT_COLORS = [
  '#f59e0b', '#ef4444', '#3b82f6', '#22c55e', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#eab308', '#6366f1',
];

export type SwatchPalette = 'jersey' | 'darkBg' | 'lightText' | 'highlight';

const PALETTES: Record<SwatchPalette, string[]> = {
  jersey: JERSEY_COLORS,
  darkBg: DARK_BG_COLORS,
  lightText: LIGHT_TEXT_COLORS,
  highlight: HIGHLIGHT_COLORS,
};

interface ColorSwatchPickerProps {
  value: string;
  onChange: (color: string) => void;
  /** Which palette of swatches to display. Default: 'jersey'. */
  palette?: SwatchPalette;
  /** When set, swatches with low contrast against this color get flagged. */
  contrastAgainst?: string;
}

export function ColorSwatchPicker({
  value,
  onChange,
  palette = 'jersey',
  contrastAgainst,
}: ColorSwatchPickerProps) {
  const theme = useThemeColors();
  const [customHex, setCustomHex] = useState(value);

  useEffect(() => {
    setCustomHex(value);
  }, [value]);

  function commitCustom() {
    const trimmed = customHex.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
      onChange(trimmed);
    } else {
      setCustomHex(value);
    }
  }

  const colors = PALETTES[palette] || JERSEY_COLORS;

  // Compute contrast for custom hex if contrastAgainst is set
  const customContrast = contrastAgainst && /^#[0-9a-fA-F]{6}$/.test(customHex.trim())
    ? contrastRatio(customHex.trim(), contrastAgainst)
    : null;
  const customContrastLow = customContrast !== null && customContrast < 3.0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {colors.map(c => {
          const isSelected = c.toLowerCase() === value.toLowerCase();
          // Contrast flagging
          let opacity = 1;
          let flagBorder = false;
          if (contrastAgainst) {
            const cr = contrastRatio(c, contrastAgainst);
            if (cr < 3.0) {
              opacity = 0.2;
              flagBorder = true;
            } else if (cr < 4.5) {
              opacity = 0.5;
            }
          }

          const isWhitish = c === '#ffffff' || c === '#f8fafc' || c === '#f9fafb' || c === '#f1f5f9';
          const isDarkish = c === '#1a1a1a' || c === '#0a0e1a' || c === '#0d1117' || c === '#0c0a09' || c === '#0f172a' || c === '#18181b' || c === '#1c1917';

          return (
            <button
              key={c}
              onClick={() => onChange(c)}
              style={{
                width: 24,
                height: 24,
                borderRadius: 4,
                background: c,
                opacity,
                border: isSelected
                  ? `2px solid ${theme.highlight}`
                  : flagBorder
                    ? '2px solid #ef4444'
                    : isWhitish
                      ? `2px solid ${theme.borderSubtle}`
                      : '2px solid transparent',
                cursor: 'pointer',
                padding: 0,
                outline: 'none',
                boxShadow: isDarkish ? `inset 0 0 0 1px ${theme.borderSubtle}` : undefined,
                transition: 'opacity 0.15s',
              }}
              title={c}
            />
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="text"
          value={customHex}
          onChange={e => setCustomHex(e.target.value)}
          onBlur={commitCustom}
          onKeyDown={e => {
            if (e.key === 'Enter') commitCustom();
          }}
          placeholder="#hexcolor"
          maxLength={7}
          style={{
            fontSize: 11,
            color: theme.secondary,
            background: theme.inputBg,
            border: `1px solid ${theme.borderSubtle}`,
            borderRadius: 4,
            padding: '3px 6px',
            fontFamily: 'monospace',
            width: 80,
            outline: 'none',
          }}
        />
        {customContrastLow && (
          <span style={{ fontSize: 10, color: '#ef4444' }} title="Low contrast — may be hard to read">
            &#x26A0; low contrast
          </span>
        )}
      </div>
    </div>
  );
}
