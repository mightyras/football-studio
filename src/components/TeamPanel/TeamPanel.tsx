import { useState } from 'react';
import { useAuth } from '../../state/AuthContext';
import { useTeam } from '../../state/TeamContext';
import { useAppState } from '../../state/AppStateContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import * as teamService from '../../services/teamService';
import * as inviteService from '../../services/inviteService';
import { generateInviteLink } from '../../services/sendInviteEmail';
import type { TeamMember, TeamRole, Invite } from '../../types';

type Props = {
  onClose: () => void;
};

function MemberRow({
  member,
  isCurrentUser,
  canManage,
  onChangeRole,
  onRemove,
  teamPlayerColor,
  teamOutlineColor,
}: {
  member: TeamMember;
  isCurrentUser: boolean;
  canManage: boolean;
  onChangeRole: (role: TeamRole) => void;
  onRemove: () => void;
  teamPlayerColor?: string | null;
  teamOutlineColor?: string | null;
}) {
  const theme = useThemeColors();
  const name = member.profile?.display_name || member.profile?.email || 'Unknown';
  const initials = name[0].toUpperCase();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 0',
        borderBottom: `1px solid ${theme.border}`,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: member.profile?.avatar_url ? 'transparent' : (teamPlayerColor || theme.borderSubtle),
          border: `2px solid ${teamOutlineColor || 'transparent'}`,
          color: '#fff',
          fontSize: 11,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {member.profile?.avatar_url ? (
          <img
            src={member.profile.avatar_url}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          initials
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            color: theme.secondary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
          {isCurrentUser && (
            <span style={{ color: theme.textSubtle, marginLeft: 4 }}>(you)</span>
          )}
        </div>
        <div style={{ fontSize: 10, color: theme.textSubtle }}>
          {member.profile?.email}
        </div>
      </div>

      <div style={{ fontSize: 10, color: theme.textMuted, flexShrink: 0 }}>
        {canManage && !isCurrentUser ? (
          <select
            value={member.role}
            onChange={(e) => onChangeRole(e.target.value as TeamRole)}
            style={{
              fontSize: 10,
              fontFamily: 'inherit',
              background: theme.inputBg,
              border: `1px solid ${theme.borderSubtle}`,
              borderRadius: 3,
              color: theme.textMuted,
              padding: '2px 4px',
              cursor: 'pointer',
            }}
          >
            <option value="admin">Admin</option>
            <option value="member">Member</option>
          </select>
        ) : (
          member.role
        )}
      </div>

      {canManage && !isCurrentUser && (
        <button
          onClick={onRemove}
          title="Remove member"
          style={{
            background: 'transparent',
            border: 'none',
            color: theme.textSubtle,
            cursor: 'pointer',
            fontSize: 14,
            padding: '2px 4px',
            lineHeight: 1,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#ef4444';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = theme.textSubtle;
          }}
        >
          &times;
        </button>
      )}
    </div>
  );
}

function PendingInviteRow({
  invite,
  onCancel,
  onCopyLink,
}: {
  invite: Invite;
  onCancel: () => void;
  onCopyLink: () => void;
}) {
  const theme = useThemeColors();
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);

  const isExpired = new Date(invite.expires_at) < new Date();

  async function handleCopy() {
    setCopying(true);
    setCopied(false);
    await onCopyLink();
    setCopying(false);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 0',
        borderBottom: `1px solid ${theme.border}`,
      }}
    >
      <div
        style={{
          flex: 1,
          fontSize: 12,
          color: theme.textMuted,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {invite.invitee_name || invite.invitee_email}
        </span>
        {isExpired && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              color: '#ef4444',
              background: 'rgba(239, 68, 68, 0.15)',
              borderRadius: 3,
              padding: '1px 5px',
              flexShrink: 0,
            }}
          >
            Expired
          </span>
        )}
      </div>
      <div style={{ fontSize: 10, color: theme.textSubtle }}>
        {invite.invitee_name ? invite.invitee_email : invite.role}
      </div>
      <button
        onClick={handleCopy}
        disabled={copying}
        title={isExpired ? 'Generate a fresh invite link' : 'Copy invite link'}
        style={{
          background: 'transparent',
          border: 'none',
          color: copied ? '#22c55e' : theme.highlight,
          cursor: copying ? 'wait' : 'pointer',
          fontSize: 10,
          fontFamily: 'inherit',
          fontWeight: 600,
          padding: '2px 6px',
          whiteSpace: 'nowrap',
        }}
      >
        {copying ? '...' : copied ? 'Copied!' : isExpired ? 'Resend Link' : 'Copy Link'}
      </button>
      <button
        onClick={onCancel}
        title="Cancel invite"
        style={{
          background: 'transparent',
          border: 'none',
          color: theme.textSubtle,
          cursor: 'pointer',
          fontSize: 14,
          padding: '2px 4px',
          lineHeight: 1,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#ef4444';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = theme.textSubtle;
        }}
      >
        &times;
      </button>
    </div>
  );
}

export function TeamPanel({ onClose }: Props) {
  const theme = useThemeColors();
  const { user } = useAuth();
  const { activeTeam, members, teams, setActiveTeamId, refresh } = useTeam();
  const { state } = useAppState();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>('member');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [pendingInvites, setPendingInvites] = useState<Invite[]>([]);
  const [loadedInvites, setLoadedInvites] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [teamName, setTeamName] = useState(activeTeam?.name ?? '');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [dangerOpen, setDangerOpen] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<TeamMember | null>(null);

  const isAdmin = activeTeam?.myRole === 'admin';

  // Load pending invites for admins
  if (isAdmin && activeTeam && !loadedInvites) {
    setLoadedInvites(true);
    inviteService.fetchTeamInvites(activeTeam.id).then(setPendingInvites);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !activeTeam) return;

    setInviting(true);
    setInviteError(null);
    setInviteSuccess(null);

    const result = await inviteService.createTeamInvite(
      activeTeam.id,
      email,
      inviteRole,
      inviteName.trim() || undefined,
      activeTeam.name,
      activeTeam.logo_url ?? undefined,
    );
    setInviting(false);

    if (result) {
      setInviteSuccess(`Invite sent to ${inviteName.trim() || email}`);
      setInviteEmail('');
      setInviteName('');
      // Refresh pending invites
      inviteService.fetchTeamInvites(activeTeam.id).then(setPendingInvites);
    } else {
      setInviteError('Failed to send invite');
    }
  }

  async function handleCopyLink() {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !activeTeam) return;

    setInviting(true);
    setInviteError(null);
    setInviteSuccess(null);

    const result = await inviteService.createTeamInviteWithLink(
      activeTeam.id,
      email,
      inviteRole,
      inviteName.trim() || undefined,
      activeTeam.name,
      activeTeam.logo_url ?? undefined,
    );
    setInviting(false);

    if (result.invite && result.inviteLink) {
      try {
        await navigator.clipboard.writeText(result.inviteLink);
        setInviteSuccess(`Link copied! Share it with ${inviteName.trim() || email}`);
      } catch {
        // Fallback: show the link if clipboard fails
        setInviteSuccess(`Invite link: ${result.inviteLink}`);
      }
      setInviteEmail('');
      setInviteName('');
      inviteService.fetchTeamInvites(activeTeam.id).then(setPendingInvites);
    } else {
      setInviteError('Failed to generate invite link');
    }
  }

  async function handleCancelInvite(inviteId: string) {
    await inviteService.cancelInvite(inviteId);
    if (activeTeam) {
      inviteService.fetchTeamInvites(activeTeam.id).then(setPendingInvites);
    }
  }

  async function handleRegenerateLink(email: string, name?: string) {
    setInviteError(null);
    setInviteSuccess(null);
    const result = await generateInviteLink(email, name);
    console.log('generateInviteLink result:', result);
    if (result.inviteLink) {
      try {
        await navigator.clipboard.writeText(result.inviteLink);
        setInviteSuccess(`Link copied for ${name || email}!`);
      } catch {
        // Fallback: show the link as text
        setInviteSuccess(`Invite link: ${result.inviteLink}`);
      }
    } else {
      setInviteError(`Failed to generate link: ${result.message || 'unknown error'}`);
    }
  }

  async function handleChangeRole(userId: string, role: TeamRole) {
    if (!activeTeam) return;
    await teamService.updateMemberRole(activeTeam.id, userId, role);
    await refresh();
  }

  function handleRemoveMember(userId: string) {
    const member = members.find((m) => m.user_id === userId);
    if (!member) return;
    setMemberError(null);
    setConfirmRemove(member);
  }

  async function confirmAndRemoveMember() {
    if (!activeTeam || !confirmRemove) return;
    const userId = confirmRemove.user_id;
    setConfirmRemove(null);
    const success = await teamService.removeMember(activeTeam.id, userId);
    if (!success) {
      setMemberError('Failed to remove member. Please try again.');
      return;
    }
    await refresh();
  }

  async function handleLeave() {
    if (!activeTeam || !user) return;
    await teamService.removeMember(activeTeam.id, user.id);
    await refresh();
    if (teams.length <= 1) onClose();
  }

  async function handleRename() {
    if (!activeTeam || !teamName.trim()) return;
    await teamService.updateTeam(activeTeam.id, teamName.trim());
    setEditingName(false);
    await refresh();
  }

  if (!activeTeam) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)',
          zIndex: 2000,
        }}
        onKeyDown={(e) => e.stopPropagation()}
        onKeyUp={(e) => e.stopPropagation()}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          style={{
            background: theme.border,
            border: `1px solid ${theme.borderSubtle}`,
            borderRadius: 8,
            padding: 24,
            minWidth: 300,
            textAlign: 'center',
            color: theme.textMuted,
            fontSize: 13,
          }}
        >
          No team selected
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        zIndex: 2000,
      }}
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: theme.border,
          border: `1px solid ${theme.borderSubtle}`,
          borderRadius: 8,
          padding: 0,
          minWidth: 360,
          maxWidth: 440,
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px 12px',
            borderBottom: `1px solid ${theme.borderSubtle}`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {editingName ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleRename();
              }}
              style={{ flex: 1, display: 'flex', gap: 6 }}
            >
              <input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                autoFocus
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  fontSize: 15,
                  fontFamily: 'inherit',
                  fontWeight: 600,
                  background: theme.inputBg,
                  border: `1px solid ${theme.highlight}`,
                  borderRadius: 4,
                  color: theme.secondary,
                  outline: 'none',
                }}
                onBlur={handleRename}
              />
            </form>
          ) : (
            <h3
              style={{
                margin: 0,
                fontSize: 15,
                fontWeight: 600,
                color: theme.secondary,
                flex: 1,
                cursor: isAdmin ? 'pointer' : 'default',
              }}
              onDoubleClick={() => {
                if (isAdmin) {
                  setTeamName(activeTeam.name);
                  setEditingName(true);
                }
              }}
              title={isAdmin ? 'Double-click to rename' : undefined}
            >
              {activeTeam.name}
            </h3>
          )}
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: theme.textSubtle,
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              padding: '2px 4px',
            }}
          >
            &times;
          </button>
        </div>

        {/* Team switcher (if multiple teams) */}
        {teams.length > 1 && (
          <div
            style={{
              padding: '8px 20px',
              borderBottom: `1px solid ${theme.borderSubtle}`,
            }}
          >
            <select
              value={activeTeam.id}
              onChange={(e) => setActiveTeamId(e.target.value)}
              style={{
                width: '100%',
                padding: '4px 8px',
                fontSize: 12,
                fontFamily: 'inherit',
                background: theme.inputBg,
                border: `1px solid ${theme.borderSubtle}`,
                borderRadius: 4,
                color: theme.secondary,
                cursor: 'pointer',
              }}
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.myRole})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Members */}
        <div style={{ padding: '12px 20px' }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: theme.textSubtle,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 8,
            }}
          >
            Members ({members.length})
          </div>
          {members.map((m) => (
            <MemberRow
              key={m.user_id}
              member={m}
              isCurrentUser={m.user_id === user?.id}
              canManage={isAdmin}
              onChangeRole={(role) => handleChangeRole(m.user_id, role)}
              onRemove={() => handleRemoveMember(m.user_id)}
              teamPlayerColor={activeTeam?.player_color || state.teamAColor}
              teamOutlineColor={activeTeam?.outline_color || state.teamAOutlineColor}
            />
          ))}
          {confirmRemove && (
            <div
              style={{
                marginTop: 8,
                padding: '10px 12px',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: 6,
              }}
            >
              <div style={{ fontSize: 12, color: theme.secondary, lineHeight: 1.5, marginBottom: 8 }}>
                Remove <strong>{confirmRemove.profile?.display_name || 'this member'}</strong>
                {confirmRemove.profile?.email && (
                  <span style={{ color: theme.textMuted }}> ({confirmRemove.profile.email})</span>
                )}
                {' '}from <strong>{activeTeam.name}</strong>?
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={confirmAndRemoveMember}
                  style={{
                    padding: '5px 12px',
                    fontSize: 11,
                    fontFamily: 'inherit',
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: 4,
                    background: '#ef4444',
                    color: '#fff',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#dc2626'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#ef4444'; }}
                >
                  Remove
                </button>
                <button
                  onClick={() => setConfirmRemove(null)}
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
              </div>
            </div>
          )}
          {memberError && (
            <div style={{ color: '#ef4444', fontSize: 11, marginTop: 6 }}>
              {memberError}
            </div>
          )}
        </div>

        {/* Pending invites (admin only) */}
        {isAdmin && pendingInvites.length > 0 && (
          <div style={{ padding: '0 20px 12px' }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: theme.textSubtle,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 8,
              }}
            >
              Pending Invites ({pendingInvites.length})
            </div>
            {pendingInvites.map((inv) => (
              <PendingInviteRow
                key={inv.id}
                invite={inv}
                onCancel={() => handleCancelInvite(inv.id)}
                onCopyLink={() => handleRegenerateLink(inv.invitee_email, inv.invitee_name ?? undefined)}
              />
            ))}
          </div>
        )}

        {/* Invite form (admin only) */}
        {isAdmin && (
          <div
            style={{
              padding: '12px 20px',
              borderTop: `1px solid ${theme.borderSubtle}`,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: theme.textSubtle,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 8,
              }}
            >
              Invite Member
            </div>
            <form
              onSubmit={handleInvite}
              style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
            >
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  placeholder="Name (optional)"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  style={{
                    width: '40%',
                    padding: '6px 8px',
                    fontSize: 12,
                    fontFamily: 'inherit',
                    background: theme.inputBg,
                    border: `1px solid ${theme.borderSubtle}`,
                    borderRadius: 4,
                    color: theme.secondary,
                    outline: 'none',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = theme.highlight;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = theme.borderSubtle;
                  }}
                />
                <input
                  type="email"
                  placeholder="Email address"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    fontSize: 12,
                    fontFamily: 'inherit',
                    background: theme.inputBg,
                    border: `1px solid ${theme.borderSubtle}`,
                    borderRadius: 4,
                    color: theme.secondary,
                    outline: 'none',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = theme.highlight;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = theme.borderSubtle;
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as TeamRole)}
                  style={{
                    padding: '6px 4px',
                    fontSize: 11,
                    fontFamily: 'inherit',
                    background: theme.inputBg,
                    border: `1px solid ${theme.borderSubtle}`,
                    borderRadius: 4,
                    color: theme.textMuted,
                    cursor: 'pointer',
                  }}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  type="submit"
                  disabled={inviting || !inviteEmail.trim()}
                  style={{
                    padding: '6px 12px',
                    fontSize: 11,
                    fontFamily: 'inherit',
                    border: 'none',
                    borderRadius: 4,
                    background:
                      inviting || !inviteEmail.trim() ? theme.textSubtle : theme.highlight,
                    color:
                      inviting || !inviteEmail.trim() ? theme.textMuted : theme.inputBg,
                    fontWeight: 600,
                    cursor:
                      inviting || !inviteEmail.trim() ? 'default' : 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {inviting ? '...' : 'Invite'}
                </button>
                <button
                  type="button"
                  disabled={inviting || !inviteEmail.trim()}
                  onClick={handleCopyLink}
                  style={{
                    padding: '6px 12px',
                    fontSize: 11,
                    fontFamily: 'inherit',
                    border: `1px solid ${theme.highlight}`,
                    borderRadius: 4,
                    background: 'transparent',
                    color:
                      inviting || !inviteEmail.trim() ? theme.textMuted : theme.highlight,
                    fontWeight: 600,
                    cursor:
                      inviting || !inviteEmail.trim() ? 'default' : 'pointer',
                    whiteSpace: 'nowrap',
                    opacity: inviting || !inviteEmail.trim() ? 0.5 : 1,
                  }}
                >
                  Copy Link
                </button>
              </div>
            </form>
            {inviteError && (
              <div style={{ color: '#ef4444', fontSize: 11, marginTop: 6 }}>
                {inviteError}
              </div>
            )}
            {inviteSuccess && (
              <div style={{ color: '#22c55e', fontSize: 11, marginTop: 6 }}>
                {inviteSuccess}
              </div>
            )}
          </div>
        )}

        {/* Danger Zone — collapsible, collapsed by default */}
        <div
          style={{
            margin: '0 20px 16px',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 6,
            background: 'rgba(239, 68, 68, 0.05)',
            overflow: 'hidden',
          }}
        >
          <button
            onClick={() => { setDangerOpen(prev => !prev); setConfirmLeave(false); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              width: '100%',
              padding: '10px 14px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <span
              style={{
                fontSize: 9,
                color: '#ef4444',
                display: 'inline-block',
                transition: 'transform 0.15s',
                transform: dangerOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
              }}
            >
              &#x25BE;
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#ef4444',
              }}
            >
              Danger Zone
            </span>
          </button>

          {dangerOpen && (
            <div style={{ padding: '0 14px 14px' }}>
              {!confirmLeave ? (
                <button
                  onClick={() => setConfirmLeave(true)}
                  style={{
                    padding: '6px 14px',
                    fontSize: 11,
                    fontFamily: 'inherit',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    borderRadius: 4,
                    background: 'transparent',
                    color: '#ef4444',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                    e.currentTarget.style.borderColor = '#ef4444';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                  }}
                >
                  Leave Team
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 12, color: theme.secondary, lineHeight: 1.4 }}>
                    Are you sure you want to leave <strong>{activeTeam.name}</strong>? This action cannot be undone.
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleLeave}
                      style={{
                        padding: '6px 14px',
                        fontSize: 11,
                        fontFamily: 'inherit',
                        fontWeight: 600,
                        border: 'none',
                        borderRadius: 4,
                        background: '#ef4444',
                        color: '#fff',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#dc2626'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#ef4444'; }}
                    >
                      Confirm Leave
                    </button>
                    <button
                      onClick={() => setConfirmLeave(false)}
                      style={{
                        padding: '6px 14px',
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
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
