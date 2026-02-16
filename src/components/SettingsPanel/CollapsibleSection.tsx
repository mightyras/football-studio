import { useState } from 'react';

export const sectionStyle: React.CSSProperties = {
  padding: '10px 0',
  borderBottom: '1px solid #1e293b',
};

export const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 6,
  display: 'block',
};

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
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={sectionStyle}>
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
            color: '#64748b',
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
        <span style={{ ...labelStyle, marginBottom: 0, flex: 1 }}>{label}</span>
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
  return (
    <span
      style={{
        display: 'inline-block',
        width: 12,
        height: 12,
        borderRadius: 3,
        background: color,
        border: color === '#ffffff' || color === '#1a1a1a'
          ? '1px solid #374151'
          : '1px solid transparent',
        flexShrink: 0,
      }}
    />
  );
}
