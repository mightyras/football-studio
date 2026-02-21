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
        border: active ? `1px solid ${theme.highlight}` : '1px solid transparent',
        borderRadius: 6,
        background: active ? hexToRgba(theme.highlight, 0.15) : 'transparent',
        color: active ? theme.highlight : theme.textMuted,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.background = theme.surfaceHover;
          e.currentTarget.style.color = theme.secondary;
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = theme.textMuted;
        }
      }}
    >
      {children}
    </button>
  );
}
