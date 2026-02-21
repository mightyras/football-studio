import type { Team } from '../../types';
import { useThemeColors } from '../../hooks/useThemeColors';

interface TeamCardProps {
  team: Team;
  memberCount: number;
  adminEmail: string | null;
  adminStatus: 'pending' | 'accepted' | 'none';
  isMember: boolean;
  onConfigure: () => void;
}

export function TeamCard({
  team,
  memberCount,
  adminEmail,
  adminStatus,
  isMember,
  onConfigure,
}: TeamCardProps) {
  const theme = useThemeColors();
  return (
    <div
      style={{
        background: theme.border,
        border: `1px solid ${theme.borderSubtle}`,
        borderRadius: 8,
        padding: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
      onClick={onConfigure}
      onMouseEnter={e => { e.currentTarget.style.borderColor = theme.textSubtle; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = theme.borderSubtle; }}
    >
      {/* Logo */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 6,
          background: theme.inputBg,
          border: `1px solid ${theme.borderSubtle}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        {team.logo_url ? (
          <img
            src={team.logo_url}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          <span style={{ fontSize: 20, color: theme.textSubtle }}>
            {team.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: theme.secondary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {team.name}
          </span>
          {isMember && (
            <span
              style={{
                fontSize: 9,
                padding: '1px 5px',
                borderRadius: 3,
                background: 'rgba(34, 197, 94, 0.15)',
                color: '#22c55e',
                fontWeight: 600,
              }}
            >
              MEMBER
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: theme.textSubtle }}>
          {/* Color swatches — all 4 branding colors */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {[
              team.highlight_color,
              team.primary_color,
              team.secondary_color,
              team.background_color,
            ].map((c, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: c || theme.textSubtle,
                  border: '1px solid rgba(255,255,255,0.1)',
                  opacity: c ? 1 : 0.4,
                }}
              />
            ))}
          </div>

          <span>{memberCount} member{memberCount !== 1 ? 's' : ''}</span>

          {adminEmail && (
            <span>
              Admin: {adminEmail}
              {adminStatus === 'pending' && (
                <span style={{ color: '#f59e0b', marginLeft: 4 }}>(pending)</span>
              )}
            </span>
          )}
          {!adminEmail && (
            <span style={{ color: theme.textMuted }}>No admin invited</span>
          )}
        </div>
      </div>

      {/* Arrow */}
      <span style={{ color: theme.textSubtle, fontSize: 16, flexShrink: 0 }}>&#x203A;</span>
    </div>
  );
}
