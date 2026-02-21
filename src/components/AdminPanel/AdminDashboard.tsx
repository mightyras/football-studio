import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../state/AuthContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useAppState } from '../../state/AppStateContext';
import { useTeam } from '../../state/TeamContext';
import * as teamService from '../../services/teamService';
import { TeamConfigPanel } from './TeamConfigPanel';
import type { Team, TeamMember } from '../../types';

interface AdminDashboardProps {
  onClose: () => void;
}

type TeamRow = {
  team: Team;
  admin: { name: string; email: string } | null;
  memberCount: number;
};

export function AdminDashboard({ onClose }: AdminDashboardProps) {
  const theme = useThemeColors();
  const { user } = useAuth();
  const { state } = useAppState();
  const { activeTeam } = useTeam();
  const [rows, setRows] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newLogoFile, setNewLogoFile] = useState<File | null>(null);
  const [newLogoPreview, setNewLogoPreview] = useState<string | null>(null);
  const [newPlayerColor, setNewPlayerColor] = useState('#e74c3c');
  const [newOutlineColor, setNewOutlineColor] = useState('#1a1a2e');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Config panel state
  const [configTeam, setConfigTeam] = useState<Team | null>(null);

  const loadTeams = useCallback(async () => {
    setLoading(true);
    try {
      const teams = await teamService.fetchCreatedTeams();
      const teamRows = await Promise.all(
        teams.map(async (team) => {
          const members = await teamService.fetchTeamMembers(team.id);
          const adminMember = members.find((m: TeamMember) => m.role === 'admin');
          return {
            team,
            admin: adminMember?.profile
              ? {
                  name: adminMember.profile.display_name || adminMember.profile.email,
                  email: adminMember.profile.email,
                }
              : null,
            memberCount: members.length,
          };
        }),
      );
      setRows(teamRows);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewLogoFile(file);
    if (newLogoPreview) URL.revokeObjectURL(newLogoPreview);
    setNewLogoPreview(URL.createObjectURL(file));
    e.target.value = '';
  }

  function resetCreateForm() {
    setNewTeamName('');
    setNewLogoFile(null);
    if (newLogoPreview) URL.revokeObjectURL(newLogoPreview);
    setNewLogoPreview(null);
    setNewPlayerColor('#e74c3c');
    setNewOutlineColor('#1a1a2e');
    setShowCreateForm(false);
    setCreateError(null);
  }

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = newTeamName.trim();
    if (!trimmedName) return;
    setCreating(true);
    setCreateError(null);

    // Step 1: Create the team (no admin invite)
    const teamId = await teamService.createTeamForAdmin(trimmedName);
    if (!teamId) {
      setCreateError('Failed to create team');
      setCreating(false);
      return;
    }

    // Step 2: Upload logo if selected
    if (newLogoFile) {
      await teamService.uploadTeamLogo(teamId, newLogoFile);
    }

    // Step 3: Save colors
    await teamService.updateTeamBranding(teamId, {
      player_color: newPlayerColor,
      outline_color: newOutlineColor,
    });

    // Step 4: Reset form and refresh list
    resetCreateForm();

    const teams = await teamService.fetchCreatedTeams();
    const newTeam = teams.find(t => t.id === teamId);
    setRows(await Promise.all(
      teams.map(async (team) => {
        const members = await teamService.fetchTeamMembers(team.id);
        const adminMember = members.find((m: TeamMember) => m.role === 'admin');
        return {
          team,
          admin: adminMember?.profile
            ? { name: adminMember.profile.display_name || adminMember.profile.email, email: adminMember.profile.email }
            : null,
          memberCount: members.length,
        };
      }),
    ));
    if (newTeam) {
      setConfigTeam(newTeam);
    }
    setCreating(false);
  }

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
        }}
        onKeyDown={e => e.stopPropagation()}
        onKeyUp={e => e.stopPropagation()}
        onClick={e => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          style={{
            background: theme.surface,
            border: `1px solid ${theme.borderSubtle}`,
            borderRadius: 10,
            width: '90%',
            maxWidth: 500,
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: `1px solid ${theme.border}`,
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>&#x1F6E1;</span>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: theme.secondary }}>
                System Admin
              </h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {!showCreateForm && (
                <button
                  onClick={() => {
                    setShowCreateForm(true);
                    setCreateError(null);
                  }}
                  style={{
                    fontSize: 11,
                    fontFamily: 'inherit',
                    padding: '4px 10px',
                    border: `1px solid ${theme.borderSubtle}`,
                    borderRadius: 4,
                    background: 'transparent',
                    color: theme.textMuted,
                    cursor: 'pointer',
                    fontWeight: 600,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = theme.highlight;
                    e.currentTarget.style.color = theme.highlight;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = theme.borderSubtle;
                    e.currentTarget.style.color = theme.textMuted;
                  }}
                >
                  + New Team
                </button>
              )}
              <button
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: theme.textSubtle,
                  cursor: 'pointer',
                  fontSize: 20,
                  padding: '0 4px',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = theme.textMuted; }}
                onMouseLeave={e => { e.currentTarget.style.color = theme.textSubtle; }}
              >
                &#x2715;
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>

            {/* Create team form */}
            {showCreateForm && (
              <form
                onSubmit={handleCreateTeam}
                style={{
                  padding: '14px',
                  background: theme.border,
                  border: `1px solid ${theme.borderSubtle}`,
                  borderRadius: 8,
                  marginBottom: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted }}>
                  Create New Team
                </div>

                {/* Team name */}
                <input
                  type="text"
                  placeholder="Team name"
                  value={newTeamName}
                  onChange={e => setNewTeamName(e.target.value)}
                  autoFocus
                  style={{
                    padding: '7px 10px',
                    fontSize: 12,
                    fontFamily: 'inherit',
                    background: theme.inputBg,
                    border: `1px solid ${theme.borderSubtle}`,
                    borderRadius: 4,
                    color: theme.secondary,
                    outline: 'none',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = theme.highlight; }}
                  onBlur={e => { e.currentTarget.style.borderColor = theme.borderSubtle; }}
                />

                {/* Logo upload */}
                <div>
                  <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 6 }}>Logo</div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    onChange={handleLogoSelect}
                    style={{ display: 'none' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 6,
                        background: theme.inputBg,
                        border: `1px solid ${theme.borderSubtle}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        flexShrink: 0,
                      }}
                    >
                      {newLogoPreview ? (
                        <img src={newLogoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      ) : (
                        <span style={{ fontSize: 18, color: theme.textSubtle }}>
                          {newTeamName.trim() ? newTeamName.trim().charAt(0).toUpperCase() : '?'}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        fontSize: 11,
                        fontFamily: 'inherit',
                        padding: '4px 10px',
                        border: `1px solid ${theme.borderSubtle}`,
                        borderRadius: 4,
                        background: 'transparent',
                        color: theme.textMuted,
                        cursor: 'pointer',
                      }}
                    >
                      {newLogoPreview ? 'Change' : 'Upload'}
                    </button>
                    {newLogoPreview && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewLogoFile(null);
                          if (newLogoPreview) URL.revokeObjectURL(newLogoPreview);
                          setNewLogoPreview(null);
                        }}
                        style={{
                          fontSize: 11,
                          fontFamily: 'inherit',
                          padding: '4px 10px',
                          border: `1px solid ${theme.borderSubtle}`,
                          borderRadius: 4,
                          background: 'transparent',
                          color: '#ef4444',
                          cursor: 'pointer',
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                {/* Colors */}
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 6 }}>Player Color</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 4,
                          background: /^#[0-9a-fA-F]{6}$/.test(newPlayerColor) ? newPlayerColor : '#ccc',
                          border: `1px solid ${theme.borderSubtle}`,
                          flexShrink: 0,
                        }}
                      />
                      <input
                        type="text"
                        value={newPlayerColor}
                        onChange={e => setNewPlayerColor(e.target.value)}
                        placeholder="#e74c3c"
                        maxLength={7}
                        style={{
                          padding: '7px 10px',
                          fontSize: 12,
                          fontFamily: 'inherit',
                          background: theme.inputBg,
                          border: `1px solid ${theme.borderSubtle}`,
                          borderRadius: 4,
                          color: theme.secondary,
                          outline: 'none',
                          width: '100%',
                        }}
                        onFocus={e => { e.currentTarget.style.borderColor = theme.highlight; }}
                        onBlur={e => { e.currentTarget.style.borderColor = theme.borderSubtle; }}
                      />
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 6 }}>Outline Color</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 4,
                          background: /^#[0-9a-fA-F]{6}$/.test(newOutlineColor) ? newOutlineColor : '#ccc',
                          border: `1px solid ${theme.borderSubtle}`,
                          flexShrink: 0,
                        }}
                      />
                      <input
                        type="text"
                        value={newOutlineColor}
                        onChange={e => setNewOutlineColor(e.target.value)}
                        placeholder="#1a1a2e"
                        maxLength={7}
                        style={{
                          padding: '7px 10px',
                          fontSize: 12,
                          fontFamily: 'inherit',
                          background: theme.inputBg,
                          border: `1px solid ${theme.borderSubtle}`,
                          borderRadius: 4,
                          color: theme.secondary,
                          outline: 'none',
                          width: '100%',
                        }}
                        onFocus={e => { e.currentTarget.style.borderColor = theme.highlight; }}
                        onBlur={e => { e.currentTarget.style.borderColor = theme.borderSubtle; }}
                      />
                    </div>
                  </div>
                </div>

                {createError && (
                  <div style={{ fontSize: 11, color: '#ef4444' }}>{createError}</div>
                )}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={resetCreateForm}
                    style={{
                      padding: '5px 12px',
                      fontSize: 11,
                      fontFamily: 'inherit',
                      border: `1px solid ${theme.borderSubtle}`,
                      borderRadius: 4,
                      background: 'transparent',
                      color: theme.textMuted,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !newTeamName.trim()}
                    style={{
                      padding: '5px 14px',
                      fontSize: 11,
                      fontFamily: 'inherit',
                      border: 'none',
                      borderRadius: 4,
                      background: creating || !newTeamName.trim() ? theme.textSubtle : theme.highlight,
                      color: creating || !newTeamName.trim() ? theme.textMuted : theme.inputBg,
                      fontWeight: 600,
                      cursor: creating || !newTeamName.trim() ? 'default' : 'pointer',
                    }}
                  >
                    {creating ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            )}

            {loading ? (
              <div style={{ textAlign: 'center', color: theme.textSubtle, fontSize: 13, padding: 20 }}>
                Loading teams...
              </div>
            ) : rows.length === 0 ? (
              <div style={{ textAlign: 'center', color: theme.textSubtle, fontSize: 13, padding: 20 }}>
                No teams found.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rows.map(({ team, admin, memberCount }) => {
                  // Use local clubIdentity logo as fallback for the active team
                  const logoSrc = team.logo_url
                    || (activeTeam && team.id === activeTeam.id ? state.clubIdentity.logoDataUrl : null)
                    || null;
                  return (
                  <div
                    key={team.id}
                    onClick={() => setConfigTeam(team)}
                    style={{
                      padding: '12px 14px',
                      background: theme.border,
                      border: `1px solid ${theme.borderSubtle}`,
                      borderRadius: 8,
                      cursor: 'pointer',
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = theme.textSubtle; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = theme.borderSubtle; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {logoSrc ? (
                          <img
                            src={logoSrc}
                            alt=""
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 4,
                              objectFit: 'contain',
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 4,
                              background: theme.inputBg,
                              border: `1px solid ${theme.borderSubtle}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              fontSize: 13,
                              color: theme.textSubtle,
                            }}
                          >
                            {team.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span style={{ fontSize: 14, fontWeight: 600, color: theme.secondary }}>
                          {team.name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: theme.textSubtle }}>
                          {memberCount} member{memberCount !== 1 ? 's' : ''}
                        </span>
                        <span style={{ color: theme.textSubtle, fontSize: 14 }}>&#x203A;</span>
                      </div>
                    </div>
                    {admin ? (
                      <div style={{ fontSize: 12, color: theme.textMuted }}>
                        Admin: {admin.name}
                        {admin.name !== admin.email && (
                          <span style={{ color: theme.textSubtle, marginLeft: 6 }}>
                            {admin.email}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: theme.textSubtle, fontStyle: 'italic' }}>
                        No admin assigned
                      </div>
                    )}
                  </div>
                  ); })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Team config panel (rendered outside the dashboard overlay) */}
      {configTeam && (
        <TeamConfigPanel
          team={configTeam}
          onClose={() => setConfigTeam(null)}
          onUpdated={() => {
            loadTeams();
          }}
        />
      )}
    </>
  );
}
