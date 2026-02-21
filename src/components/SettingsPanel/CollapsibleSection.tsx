import { useState } from 'react';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { ThemeColors } from '../../hooks/useThemeColors';

export function sectionStyle(theme: ThemeColors): React.CSSProperties {
  return {
    padding: '10px 0',
    borderBottom: `1px solid ${theme.border}`,
  };
}

export function labelStyle(theme: ThemeColors): React.CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 600,
    color: theme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 6,
    display: 'block',
  };
}

export function CollapsibleSection({
  label,
  defaultOpen = false,
  preview,
  children,
}: {
  label: React.ReactNode;
  defaultOpen?: boolean;
  preview?: React.ReactNode;
  children: React.ReactNode;
}) {
  const theme = useThemeColors();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={sectionStyle(theme)}>
      <button
        onClick={() => setOpen(prev => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          gap: 6,
          textAlign: 'left',
        }}
      >
        <span
          style={{
            fontSize: 9,
            color: theme.textSubtle,
            transition: 'transform 0.15s',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            flexShrink: 0,
            width: 10,
            display: 'inline-flex',
            justifyContent: 'center',
          }}
        >
          ▶
        </span>
        <span style={{ ...labelStyle(theme), marginBottom: 0, flex: 1 }}>{label}</span>
        {!open && preview && (
          <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
            {preview}
          </span>
        )}
      </button>
      {open && <div style={{ marginTop: 8 }}>{children}</div>}
    </div>
  );
}

export function ColorDot({ color }: { color: string }) {
  const theme = useThemeColors();
  return (
    <span
      style={{
        display: 'inline-block',
        width: 12,
        height: 12,
        borderRadius: 3,
        background: color,
        border: color === '#ffffff' || color === '#1a1a1a'
          ? `1px solid ${theme.borderSubtle}`
          : '1px solid transparent',
        flexShrink: 0,
      }}
    />
  );
}
