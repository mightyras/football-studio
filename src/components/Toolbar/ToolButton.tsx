import { type ReactNode } from 'react';
import { useThemeColors } from '../../hooks/useThemeColors';
import { hexToRgba } from '../../utils/colorUtils';

interface ToolButtonProps {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: ReactNode;
}

export function ToolButton({ active, onClick, title, children }: ToolButtonProps) {
  const theme = useThemeColors();
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 40,
        height: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: active ? `1px solid ${theme.accent}` : '1px solid transparent',
        borderRadius: 6,
        background: active ? hexToRgba(theme.accent, 0.15) : 'transparent',
        color: active ? theme.accent : '#94a3b8',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.background = '#1f2937';
          e.currentTarget.style.color = '#e2e8f0';
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = '#94a3b8';
        }
      }}
    >
      {children}
    </button>
  );
}
