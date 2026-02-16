import { useState, useEffect } from 'react';
import { useThemeColors } from '../../hooks/useThemeColors';

const JERSEY_COLORS = [
  '#ef4444', // red
  '#3b82f6', // blue
  '#22c55e', // green
  '#3F8E51', // dark green
  '#eab308', // yellow
  '#ffffff', // white
  '#1a1a1a', // black
  '#f97316', // orange
  '#a855f7', // purple
  '#06b6d4', // cyan
  '#ec4899', // pink
];

export function ColorSwatchPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {JERSEY_COLORS.map(c => (
          <button
            key={c}
            onClick={() => onChange(c)}
            style={{
              width: 24,
              height: 24,
              borderRadius: 4,
              background: c,
              border: c.toLowerCase() === value.toLowerCase()
                ? `2px solid ${theme.accent}`
                : c === '#ffffff'
                  ? '2px solid #374151'
                  : '2px solid transparent',
              cursor: 'pointer',
              padding: 0,
              outline: 'none',
              boxShadow: c === '#1a1a1a' ? 'inset 0 0 0 1px #374151' : undefined,
            }}
            title={c}
          />
        ))}
      </div>
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
          color: '#e2e8f0',
          background: '#0f172a',
          border: '1px solid #374151',
          borderRadius: 4,
          padding: '3px 6px',
          fontFamily: 'monospace',
          width: 80,
          outline: 'none',
        }}
      />
    </div>
  );
}
