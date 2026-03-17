import { useThemeColors } from '../../hooks/useThemeColors';
import { hexToRgba } from '../../utils/colorUtils';
import type { PositionRole } from '../../types';
import { ROLE_LABELS } from '../../types';

interface MatchPlayerRowProps {
  number: number;
  name: string;
  role: PositionRole;
  minutesPlayed: number;
  totalMinutes: number;
  positionHistory: Array<{ role: PositionRole; from: number; to: number }>;
  isOnPitch: boolean;
  teamColor: string;
  subMinute?: number; // minute they were subbed in/out
}

export function MatchPlayerRow({
  number,
  name,
  role,
  minutesPlayed,
  totalMinutes,
  positionHistory,
  isOnPitch,
  teamColor,
  subMinute,
}: MatchPlayerRowProps) {
  const theme = useThemeColors();
  const barWidth = totalMinutes > 0 ? (minutesPlayed / totalMinutes) * 100 : 0;

  // Get unique positions played
  const positions = [...new Set(positionHistory.map(h => h.role))];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 12px',
        opacity: 1,
      }}
    >
      {/* Number badge */}
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: isOnPitch ? teamColor : hexToRgba(teamColor, 0.4),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          fontWeight: 700,
          color: '#fff',
          flexShrink: 0,
        }}
      >
        {number}
      </div>

      {/* Name + position */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            color: theme.secondary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name || `Player #${number}`}
        </div>
        <div style={{ fontSize: 9, color: theme.textSubtle, display: 'flex', gap: 4 }}>
          {positions.map(pos => (
            <span
              key={pos}
              style={{
                background: hexToRgba(theme.highlight, 0.12),
                color: theme.highlight,
                padding: '0 3px',
                borderRadius: 2,
                fontSize: 8,
                fontWeight: 600,
              }}
            >
              {ROLE_LABELS[pos] || pos}
            </span>
          ))}
          {subMinute !== undefined && (
            <span style={{ color: theme.textSubtle }}>
              {isOnPitch ? `${subMinute}'→` : `→${subMinute}'`}
            </span>
          )}
        </div>
      </div>

      {/* Minutes bar */}
      <div style={{ width: 60, flexShrink: 0 }}>
        <div
          style={{
            height: 6,
            background: hexToRgba(theme.borderSubtle, 0.5),
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${barWidth}%`,
              background: '#22c55e',
              borderRadius: 3,
              transition: 'width 0.2s',
            }}
          />
        </div>
      </div>

      {/* Minutes text */}
      <span
        style={{
          fontSize: 10,
          color: theme.textMuted,
          fontWeight: 600,
          width: 32,
          textAlign: 'right',
          flexShrink: 0,
        }}
      >
        {minutesPlayed}&prime;
      </span>
    </div>
  );
}
