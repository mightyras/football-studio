import { useState, useRef, useEffect } from 'react';
import type { Team, TeamMember, Invite } from '../../types';
import { useThemeColors } from '../../hooks/useThemeColors';
import * as teamService from '../../services/teamService';
import * as inviteService from '../../services/inviteService';

interface TeamConfigPanelProps {
  team: Team;
  onClose: () => void;
  onUpdated: () => void;
}

export function TeamConfigPanel({ team, onClose, onUpdated }: TeamConfigPanelProps) {
  const theme = useThemeColors();

  const smallLabelStyle: React.CSSProperties = {
    fontSize: 11,
    color: theme.textMuted,
    marginBottom: 4,
    display: 'block',
  };
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(team.name);
  const [playerColor, setPlayerColor] = useState(team.player_color || '');
  const [outlineColor, setOutlineColor] = useState(team.outline_color || '');
  const [logoUrl, setLogoUrl] = useState(team.logo_url);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [teamInvites, setTeamInvites] = useState<Invite[]>([]);

  // Editing name
  const [editingName, setEditingName] = useState(false);

  // Delete team
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    loadTeamData();
  }, [team.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadTeamData() {
    const [m, inv] = await Promise.all([
      teamService.fetchTeamMembers(team.id),
      inviteService.fetchTeamInvites(team.id),
    ]);
    setMembers(m);
    setTeamInvites(inv);
  }

  const adminInvite = teamInvites.find(inv => inv.role === 'admin');
  const adminMember = members.find(m => m.role === 'admin');

  // Once the team admin has accepted the invite, branding is locked for the super admin
  const adminTookOver = !!adminMember;

  async function handleSaveBranding() {
    if (adminTookOver) return;
    setSaving(true);
    const updated: Record<string, string | null> = {};
    if (name !== team.name) {
      await teamService.updateTeam(team.id, name);
    }
    if (playerColor !== (team.player_color || '')) {
      updated.player_color = playerColor || null;
    }
    if (outlineColor !== (team.outline_color || '')) {
      updated.outline_color = outlineColor || null;
    }
    if (Object.keys(updated).length > 0) {
      await teamService.updateTeamBranding(team.id, updated);
    }
    setSaving(false);
    onUpdated();
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (adminTookOver) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await teamService.uploadTeamLogo(team.id, file);
    if (url) {
      setLogoUrl(url);
      onUpdated();
    }
    setUploading(false);
    e.target.value = '';
  }

  async function handleRemoveLogo() {
    if (adminTookOver) return;
    setUploading(true);
    await teamService.deleteTeamLogo(team.id);
    setLogoUrl(null);
    onUpdated();
    setUploading(false);
  }

  async function handleInviteAdmin(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = inviteEmail.trim();
    if (!trimmed) return;
    setInviting(true);
    setInviteError(null);
    const ok = await inviteService.createTeamInvite(team.id, trimmed, 'admin', inviteName, team.name, team.logo_url ?? undefined);
    if (ok) {
      setInviteEmail('');
      setInviteName('');
      await loadTeamData();
    } else {
      setInviteError('Failed to send invite');
    }
    setInviting(false);
  }

  async function handleDeleteTeam() {
    setDeleting(true);
    setDeleteError(null);
    const ok = await teamService.deleteTeam(team.id);
    if (ok) {
      onUpdated();
      onClose();
    } else {
      setDeleteError('Failed to delete team. Please try again.');
      setDeleting(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2100,
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
          borderRadius: 8,
          width: '90%',
          maxWidth: 480,
          maxHeight: '85vh',
          overflow: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
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
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: theme.textSubtle,
                cursor: 'pointer',
                fontSize: 18,
                padding: 0,
                fontFamily: 'inherit',
              }}
              title="Back"
            >
              &#x2039;
            </button>
            {!adminTookOver && editingName ? (
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                onBlur={() => {
                  setEditingName(false);
                  if (name.trim() && name !== team.name) handleSaveBranding();
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') {
                    setName(team.name);
                    setEditingName(false);
                  }
                }}
                autoFocus
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: theme.secondary,
                  background: theme.inputBg,
                  border: `1px solid ${theme.highlight}`,
                  borderRadius: 4,
                  padding: '2px 8px',
                  fontFamily: 'inherit',
                  outline: 'none',
                  width: 200,
                }}
              />
            ) : (
              <h3
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 700,
                  color: theme.secondary,
                  cursor: adminTookOver ? 'default' : 'pointer',
                }}
                onDoubleClick={() => { if (!adminTookOver) setEditingName(true); }}
                title={adminTookOver ? undefined : 'Double-click to rename'}
              >
                {name}
              </h3>
            )}
          </div>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Locked banner ── */}
          {adminTookOver && (
            <div
              style={{
                padding: '10px 14px',
                background: 'rgba(100, 116, 139, 0.1)',
                border: `1px solid ${theme.borderSubtle}`,
                borderRadius: 6,
                fontSize: 12,
                color: theme.textMuted,
                lineHeight: 1.5,
              }}
            >
              <span style={{ fontWeight: 600, color: theme.secondary }}>
                {adminMember.profile?.display_name || adminMember.profile?.email || 'Team admin'}
              </span>{' '}
              has taken over this team. Branding is now managed by the team admin.
            </div>
          )}

          {/* ── Appearance Section (hidden when admin has taken over) ── */}
          {!adminTookOver && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Appearance
            </div>

            {/* Logo */}
            <span style={smallLabelStyle}>Team Logo</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
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
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <span style={{ fontSize: 24, color: theme.textSubtle }}>
                    {team.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              {!adminTookOver && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    style={{
                      fontSize: 11,
                      fontFamily: 'inherit',
                      padding: '4px 10px',
                      border: `1px solid ${theme.borderSubtle}`,
                      borderRadius: 4,
                      background: 'transparent',
                      color: theme.textMuted,
                      cursor: uploading ? 'wait' : 'pointer',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = theme.textSubtle; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = theme.borderSubtle; }}
                  >
                    {uploading ? 'Uploading...' : logoUrl ? 'Change' : 'Upload'}
                  </button>
                  {logoUrl && (
                    <button
                      onClick={handleRemoveLogo}
                      disabled={uploading}
                      style={{
                        fontSize: 11,
                        fontFamily: 'inherit',
                        padding: '4px 10px',
                        border: `1px solid ${theme.borderSubtle}`,
                        borderRadius: 4,
                        background: 'transparent',
                        color: '#ef4444',
                        cursor: uploading ? 'wait' : 'pointer',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = theme.borderSubtle; }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={handleLogoUpload}
                style={{ display: 'none' }}
              />
            </div>

            {/* Colors */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <span style={{ ...smallLabelStyle, marginBottom: 6 }}>Player Color</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 4,
                      background: /^#[0-9a-fA-F]{6}$/.test(playerColor || '') ? playerColor : '#e74c3c',
                      border: `1px solid ${theme.borderSubtle}`,
                      flexShrink: 0,
                    }}
                  />
                  <input
                    type="text"
                    value={playerColor || '#e74c3c'}
                    onChange={e => setPlayerColor(e.target.value)}
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
                <span style={{ ...smallLabelStyle, marginBottom: 6 }}>Outline Color</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 4,
                      background: /^#[0-9a-fA-F]{6}$/.test(outlineColor || '') ? outlineColor : '#1a1a2e',
                      border: `1px solid ${theme.borderSubtle}`,
                      flexShrink: 0,
                    }}
                  />
                  <input
                    type="text"
                    value={outlineColor || '#1a1a2e'}
                    onChange={e => setOutlineColor(e.target.value)}
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

            {/* Save branding button */}
            <button
              onClick={handleSaveBranding}
              disabled={saving}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                fontFamily: 'inherit',
                border: `1px solid ${theme.highlight}`,
                borderRadius: 4,
                background: 'rgba(245, 158, 11, 0.15)',
                color: theme.highlight,
                fontWeight: 600,
                cursor: saving ? 'wait' : 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245, 158, 11, 0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(245, 158, 11, 0.15)'; }}
            >
              {saving ? 'Saving...' : 'Save Branding'}
            </button>
          </div>
          )}

          {/* ── Admin Section ── */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Team Admin
            </div>

            {adminMember ? (
              <div style={{ fontSize: 12, color: theme.secondary, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 14 }}>&#x2705;</span>
                <span>
                  {adminMember.profile?.display_name || adminMember.profile?.email || 'Admin'}
                  <span style={{ color: '#22c55e', marginLeft: 6, fontSize: 10 }}>active</span>
                </span>
              </div>
            ) : adminInvite ? (
              <div style={{ fontSize: 12, color: theme.secondary, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 14 }}>&#x2709;</span>
                <span>
                  {adminInvite.invitee_name
                    ? <>{adminInvite.invitee_name} <span style={{ color: theme.textSubtle }}>({adminInvite.invitee_email})</span></>
                    : adminInvite.invitee_email}
                  <span style={{ color: '#f59e0b', marginLeft: 6, fontSize: 10 }}>
                    {adminInvite.status === 'pending' ? 'invite pending' : adminInvite.status}
                  </span>
                </span>
              </div>
            ) : (
              <form onSubmit={handleInviteAdmin} style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                <input
                  type="text"
                  placeholder="Admin name"
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    fontSize: 12,
                    fontFamily: 'inherit',
                    background: theme.inputBg,
                    border: `1px solid ${theme.borderSubtle}`,
                    borderRadius: 4,
                    color: theme.secondary,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = theme.highlight; }}
                  onBlur={e => { e.currentTarget.style.borderColor = theme.borderSubtle; }}
                />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="email"
                    placeholder="Admin email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
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
                  <button
                    type="submit"
                    disabled={inviting || !inviteEmail.trim()}
                    style={{
                      padding: '6px 12px',
                      fontSize: 11,
                      fontFamily: 'inherit',
                      border: 'none',
                      borderRadius: 4,
                      background: inviting || !inviteEmail.trim() ? theme.textSubtle : theme.highlight,
                      color: inviting || !inviteEmail.trim() ? theme.textMuted : theme.inputBg,
                      fontWeight: 600,
                      cursor: inviting || !inviteEmail.trim() ? 'default' : 'pointer',
                    }}
                  >
                    {inviting ? '...' : 'Invite'}
                  </button>
                </div>
              </form>
            )}
            {inviteError && (
              <div style={{ fontSize: 11, color: '#ef4444', marginBottom: 8 }}>{inviteError}</div>
            )}
          </div>

          {/* ── Members Section (read-only overview) ── */}
          {members.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Members ({members.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {members.map(m => {
                  const memberName = m.profile?.display_name || m.profile?.email || m.user_id.slice(0, 8);
                  const memberInitials = memberName[0].toUpperCase();
                  return (
                  <div
                    key={m.user_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 10px',
                      background: theme.border,
                      borderRadius: 4,
                      fontSize: 12,
                      color: theme.secondary,
                    }}
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: playerColor || '#e74c3c',
                        border: `2px solid ${outlineColor || 'transparent'}`,
                        color: '#fff',
                        fontSize: 9,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {memberInitials}
                    </div>
                    <span style={{ flex: 1 }}>
                      {memberName}
                    </span>
                    <span style={{ fontSize: 10, color: theme.textSubtle }}>{m.role}</span>
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Danger Zone ── */}
          <div
            style={{
              borderTop: '1px solid rgba(239, 68, 68, 0.3)',
              paddingTop: 20,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Danger Zone
            </div>

            {!showDeleteConfirm ? (
              <button
                onClick={() => { setShowDeleteConfirm(true); setDeleteConfirmText(''); setDeleteError(null); }}
                style={{
                  padding: '6px 14px',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: 4,
                  background: 'rgba(239, 68, 68, 0.08)',
                  color: '#ef4444',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.18)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'; }}
              >
                Delete Team
              </button>
            ) : (
              <div
                style={{
                  padding: 14,
                  background: 'rgba(239, 68, 68, 0.06)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>
                  Are you sure? This cannot be undone.
                </div>
                <div style={{ fontSize: 11, color: theme.textMuted, lineHeight: 1.5 }}>
                  This will permanently delete <strong style={{ color: theme.secondary }}>{team.name}</strong> and
                  all associated data including team members and pending invites.
                </div>
                <div style={{ fontSize: 11, color: theme.textMuted }}>
                  Type <strong style={{ color: theme.secondary }}>{team.name}</strong> to confirm:
                </div>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  autoFocus
                  placeholder={team.name}
                  style={{
                    padding: '7px 10px',
                    fontSize: 12,
                    fontFamily: 'inherit',
                    background: theme.inputBg,
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 4,
                    color: theme.secondary,
                    outline: 'none',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#ef4444'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)'; }}
                />
                {deleteError && (
                  <div style={{ fontSize: 11, color: '#ef4444' }}>{deleteError}</div>
                )}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); setDeleteError(null); }}
                    disabled={deleting}
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
                    type="button"
                    onClick={handleDeleteTeam}
                    disabled={deleting || deleteConfirmText !== team.name}
                    style={{
                      padding: '5px 14px',
                      fontSize: 11,
                      fontFamily: 'inherit',
                      border: 'none',
                      borderRadius: 4,
                      background: deleting || deleteConfirmText !== team.name
                        ? 'rgba(239, 68, 68, 0.15)'
                        : '#ef4444',
                      color: deleting || deleteConfirmText !== team.name
                        ? 'rgba(239, 68, 68, 0.4)'
                        : '#fff',
                      fontWeight: 600,
                      cursor: deleting || deleteConfirmText !== team.name ? 'default' : 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {deleting ? 'Deleting...' : 'Permanently Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
