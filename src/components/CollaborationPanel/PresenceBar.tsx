import { useThemeColors } from '../../hooks/useThemeColors';
import type { OnlineUser } from '../../types';

interface PresenceBarProps {
  onlineUsers: OnlineUser[];
  isConnected: boolean;
  onLeave?: () => void;
}

/** Small bar showing connected user avatars during active collaboration. */
export function PresenceBar({ onlineUsers, isConnected, onLeave }: PresenceBarProps) {
  const theme = useThemeColors();

  if (!isConnected) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        background: theme.surface,
        borderBottom: `1px solid ${theme.border}`,
        fontSize: 11,
        color: theme.textMuted,
        flexShrink: 0,
      }}
    >
      {/* Connection indicator */}
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: '#4ade80',
          flexShrink: 0,
        }}
      />
      <span style={{ fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Live
      </span>

      {/* User avatars */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 4 }}>
        {onlineUsers.map(user => (
          <div
            key={user.userId}
            title={user.displayName}
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: stringToColor(user.userId),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 9,
              fontWeight: 700,
              color: '#fff',
              border: `1.5px solid ${theme.surface}`,
              flexShrink: 0,
            }}
          >
            {getInitials(user.displayName)}
          </div>
        ))}
      </div>

      {onlineUsers.length > 0 && (
        <span style={{ fontSize: 10, color: theme.textMuted }}>
          {onlineUsers.length} other{onlineUsers.length !== 1 ? 's' : ''} online
        </span>
      )}
      {onlineUsers.length === 0 && (
        <span style={{ fontSize: 10, color: theme.textMuted }}>
          Only you
        </span>
      )}

      {/* Leave button */}
      {onLeave && (
        <button
          onClick={onLeave}
          style={{
            marginLeft: 'auto',
            padding: '2px 8px',
            fontSize: 10,
            fontFamily: 'inherit',
            fontWeight: 600,
            border: `1px solid ${theme.textSubtle}`,
            borderRadius: 4,
            background: 'transparent',
            color: theme.textMuted,
            cursor: 'pointer',
          }}
        >
          Leave
        </button>
      )}
    </div>
  );
}

/** Get initials from a display name (max 2 chars). */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

/** Generate a consistent color from a userId string. */
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 45%)`;
}
