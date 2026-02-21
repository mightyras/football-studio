import type { Formation } from '../../types';
import { useThemeColors } from '../../hooks/useThemeColors';
import { hexToRgba } from '../../utils/colorUtils';

interface FormationCardProps {
  formation: Formation;
  active: boolean;
  onClick: () => void;
}

export function FormationCard({ formation, active, onClick }: FormationCardProps) {
  const theme = useThemeColors();
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        width: '100%',
        padding: '6px 4px',
        border: active ? `1px solid ${theme.highlight}` : '1px solid transparent',
        borderRadius: 6,
        background: active ? hexToRgba(theme.highlight, 0.1) : 'transparent',
        color: active ? theme.highlight : theme.secondary,
        cursor: 'pointer',
        textAlign: 'center',
        fontSize: 11.5,
        fontFamily: 'inherit',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => {
        if (!active) e.currentTarget.style.background = theme.surfaceHover;
      }}
      onMouseLeave={e => {
        if (!active) e.currentTarget.style.background = 'transparent';
      }}
    >
      {/* Mini pitch preview */}
      <svg width="44" height="28" viewBox="0 0 44 28" style={{ flexShrink: 0 }}>
        <rect x="0" y="0" width="44" height="28" rx="2" fill="#1a5c2a" />
        <line x1="22" y1="0" x2="22" y2="28" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5" />
        {/* GK */}
        <circle cx={3} cy={14} r={1.8} fill={active ? theme.highlight : theme.textMuted} />
        {/* Outfield */}
        {formation.positions.map((pos, i) => (
          <circle
            key={i}
            cx={3 + pos.x * 38}
            cy={pos.y * 26 + 1}
            r={1.8}
            fill={active ? theme.highlight : theme.textMuted}
          />
        ))}
      </svg>
      <span
        style={{
          fontWeight: active ? 600 : 400,
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '100%',
        }}
      >
        {formation.name}
      </span>
    </button>
  );
}
