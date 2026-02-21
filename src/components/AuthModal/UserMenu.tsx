import { useState, useRef, useEffect } from 'react';
import { useAuth, type Profile } from '../../state/AuthContext';
import { useTeam } from '../../state/TeamContext';
import { useAppState } from '../../state/AppStateContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import { TeamPanel } from '../TeamPanel/TeamPanel';
import { AdminDashboard } from '../AdminPanel/AdminDashboard';
import { TeamAdminPanel } from '../AdminPanel/TeamAdminPanel';
import { ProfilePanel } from '../ProfilePanel/ProfilePanel';

function getInitials(profile: Profile): string {
  if (profile.display_name) {
    const parts = profile.display_name.trim().split(/\s+/);
    return parts.map(p => p[0]).slice(0, 2).join('').toUpperCase();
  }
  return profile.email[0].toUpperCase();
}

const baseMenuItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '8px 14px',
  fontSize: 12,
  fontFamily: 'inherit',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'background 0.1s',
};

export function UserMenu() {
  const { profile, signOut } = useAuth();
  const { activeTeam, pendingInvites, isSuperAdmin, refresh } = useTeam();
  const { state } = useAppState();
  const theme = useThemeColors();

  // Resolve team logo: prefer local clubIdentity logo, then DB logo_url
  const teamLogoSrc = state.clubIdentity.logoDataUrl || activeTeam?.logo_url || null;
  const menuItemStyle: React.CSSProperties = { ...baseMenuItemStyle, color: theme.textMuted };
  const [open, setOpen] = useState(false);
  const [showTeamPanel, setShowTeamPanel] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [showTeamAdminPanel, setShowTeamAdminPanel] = useState(false);
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  if (!profile) return null;

  const initials = getInitials(profile);
  const hasInvites = pendingInvites.length > 0;

  return (
    <>
      <div ref={menuRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen(prev => !prev)}
          title={profile.display_name ?? profile.email}
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: open
              ? `2px solid ${theme.highlight}`
              : `2px solid ${activeTeam?.outline_color || state.teamAOutlineColor || theme.textSubtle}`,
            background: profile.avatar_url
              ? 'transparent'
              : activeTeam?.player_color || state.teamAColor || theme.borderSubtle,
            color: '#fff',
            fontSize: 11,
            fontWeight: 600,
            fontFamily: 'inherit',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            padding: 0,
            transition: 'border-color 0.15s',
            position: 'relative',
          }}
        >
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            initials
          )}
          {/* Notification dot for pending invites */}
          {hasInvites && (
            <div
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#f59e0b',
                border: `1.5px solid ${theme.border}`,
              }}
            />
          )}
        </button>

        {open && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 6,
              background: theme.border,
              border: `1px solid ${theme.borderSubtle}`,
              borderRadius: 6,
              padding: '8px 0',
              minWidth: 200,
              zIndex: 1000,
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            }}
          >
            {/* User info */}
            <div style={{ padding: '6px 14px 10px', borderBottom: `1px solid ${theme.borderSubtle}` }}>
              {profile.display_name && (
                <div style={{ fontSize: 13, fontWeight: 600, color: theme.secondary }}>
                  {profile.display_name}
                </div>
              )}
              <div style={{ fontSize: 11, color: theme.textSubtle, marginTop: 2 }}>
                {profile.email}
              </div>
            </div>

            {/* Account Settings */}
            <div style={{ borderBottom: `1px solid ${theme.borderSubtle}` }}>
              <button
                onClick={() => {
                  setOpen(false);
                  setShowProfilePanel(true);
                }}
                style={menuItemStyle}
                onMouseEnter={e => { e.currentTarget.style.background = theme.borderSubtle; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                Account Settings
              </button>
            </div>

            {/* Team section — only shown if user belongs to a team */}
            {(activeTeam || hasInvites) && (
              <div style={{ borderBottom: `1px solid ${theme.borderSubtle}` }}>
                {activeTeam && (
                  <button
                    onClick={() => {
                      setOpen(false);
                      setShowTeamPanel(true);
                    }}
                    style={menuItemStyle}
                    onMouseEnter={e => { e.currentTarget.style.background = theme.borderSubtle; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {teamLogoSrc ? (
                        <img
                          src={teamLogoSrc}
                          alt=""
                          style={{
                            width: 16,
                            height: 16,
                            objectFit: 'contain',
                            borderRadius: 2,
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: 13 }}>&#x1F465;</span>
                      )}
                      <span>{activeTeam.name}</span>
                      <span style={{ fontSize: 10, color: theme.textSubtle, marginLeft: 'auto' }}>
                        {activeTeam.myRole}
                      </span>
                    </div>
                  </button>
                )}

                {/* Team Settings — visible to team admins */}
                {activeTeam?.myRole === 'admin' && (
                  <button
                    onClick={() => {
                      setOpen(false);
                      setShowTeamAdminPanel(true);
                    }}
                    style={menuItemStyle}
                    onMouseEnter={e => { e.currentTarget.style.background = theme.borderSubtle; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13 }}>&#x2699;&#xFE0F;</span>
                      <span>Team Settings</span>
                    </div>
                  </button>
                )}

                {/* Pending invites indicator */}
                {hasInvites && (
                  <div
                    style={{
                      padding: '6px 14px',
                      fontSize: 11,
                      color: '#f59e0b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span style={{ fontSize: 8 }}>&#x25CF;</span>
                    {pendingInvites.length} pending invite{pendingInvites.length > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            )}

            {/* Admin Dashboard (super admins only) */}
            {isSuperAdmin && (
              <div style={{ borderBottom: `1px solid ${theme.borderSubtle}` }}>
                <button
                  onClick={() => {
                    setOpen(false);
                    setShowAdminDashboard(true);
                  }}
                  style={menuItemStyle}
                  onMouseEnter={e => { e.currentTarget.style.background = theme.borderSubtle; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13 }}>&#x1F6E1;</span>
                    <span>System Admin</span>
                  </div>
                </button>
              </div>
            )}

            {/* Sign out */}
            <button
              onClick={async () => {
                setOpen(false);
                await signOut();
              }}
              style={menuItemStyle}
              onMouseEnter={e => { e.currentTarget.style.background = theme.borderSubtle; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              Sign Out
            </button>
          </div>
        )}
      </div>

      {/* Modals rendered outside the dropdown */}
      {showTeamPanel && (
        <TeamPanel onClose={() => setShowTeamPanel(false)} />
      )}
      {showAdminDashboard && (
        <AdminDashboard onClose={() => setShowAdminDashboard(false)} />
      )}
      {showTeamAdminPanel && activeTeam && (
        <TeamAdminPanel
          team={activeTeam}
          onClose={() => setShowTeamAdminPanel(false)}
          onUpdated={refresh}
        />
      )}
      {showProfilePanel && (
        <ProfilePanel onClose={() => setShowProfilePanel(false)} />
      )}
    </>
  );
}
