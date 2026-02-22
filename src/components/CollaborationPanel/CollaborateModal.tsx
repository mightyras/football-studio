import { useState, useRef, useEffect } from 'react';
import { useThemeColors } from '../../hooks/useThemeColors';
import { hexToRgba } from '../../utils/colorUtils';
import { createBoardInvite, createBoardInviteWithLink, fetchBoardCollaborators, fetchBoardInvites, removeBoardCollaborator, cancelBoardInvite } from '../../services/collaborationService';
import { generateInviteLink } from '../../services/sendInviteEmail';
import type { BoardCollaborator, Invite } from '../../types';

function PendingBoardInviteRow({
  invite,
  onCancel,
  onCopyLink,
}: {
  invite: Invite;
  onCancel: () => void;
  onCopyLink: () => Promise<void>;
}) {
  const theme = useThemeColors();
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);

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
        justifyContent: 'space-between',
        padding: '6px 0',
        borderBottom: `1px solid ${theme.borderSubtle}`,
      }}
    >
      <span style={{ fontSize: 12, color: theme.textMuted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {invite.invitee_name || invite.invitee_email}
        {invite.invitee_name && (
          <span style={{ fontSize: 10, marginLeft: 6, color: theme.textSubtle }}>
            {invite.invitee_email}
          </span>
        )}
      </span>
      <button
        onClick={handleCopy}
        disabled={copying}
        style={{
          fontSize: 10,
          fontFamily: 'inherit',
          fontWeight: 600,
          border: 'none',
          background: 'transparent',
          color: copied ? '#22c55e' : theme.highlight,
          cursor: copying ? 'wait' : 'pointer',
          padding: '2px 6px',
          whiteSpace: 'nowrap',
        }}
      >
        {copying ? '...' : copied ? 'Copied!' : 'Copy Link'}
      </button>
      <button
        onClick={onCancel}
        style={{
          fontSize: 10,
          fontFamily: 'inherit',
          border: 'none',
          background: 'transparent',
          color: theme.textMuted,
          cursor: 'pointer',
          padding: '2px 6px',
        }}
      >
        Cancel
      </button>
    </div>
  );
}

interface CollaborateModalProps {
  boardId: string;
  boardName: string;
  isOwner: boolean;
  onClose: () => void;
}

export function CollaborateModal({ boardId, boardName, isOwner, onClose }: CollaborateModalProps) {
  const theme = useThemeColors();
  const dialogRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [permission, setPermission] = useState<'view' | 'edit'>('edit');
  const [collaborators, setCollaborators] = useState<BoardCollaborator[]>([]);
  const [pendingInvites, setPendingInvites] = useState<Invite[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load collaborators and pending invites
  useEffect(() => {
    loadData();
  }, [boardId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    const [collabs, invites] = await Promise.all([
      fetchBoardCollaborators(boardId),
      isOwner ? fetchBoardInvites(boardId) : Promise.resolve([]),
    ]);
    setCollaborators(collabs);
    setPendingInvites(invites);
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    if (isOwner) emailRef.current?.focus();
  }, [isOwner]);

  async function handleInvite() {
    if (!email.trim()) return;
    setSending(true);
    setError(null);
    setSuccess(null);

    const result = await createBoardInvite(boardId, email.trim(), permission, inviteName.trim() || undefined);
    if (result) {
      setSuccess(`Invite sent to ${inviteName.trim() || email.trim()}`);
      setEmail('');
      setInviteName('');
      await loadData();
    } else {
      setError('Failed to send invite. Check the email address.');
    }
    setSending(false);
  }

  async function handleCopyLink() {
    if (!email.trim()) return;
    setSending(true);
    setError(null);
    setSuccess(null);

    const result = await createBoardInviteWithLink(boardId, email.trim(), permission, inviteName.trim() || undefined);
    if (result.invite && result.inviteLink) {
      try {
        await navigator.clipboard.writeText(result.inviteLink);
        setSuccess(`Link copied! Share it with ${inviteName.trim() || email.trim()}`);
      } catch {
        // Fallback: show the link if clipboard fails
        setSuccess(`Invite link: ${result.inviteLink}`);
      }
      setEmail('');
      setInviteName('');
      await loadData();
    } else {
      setError('Failed to generate invite link.');
    }
    setSending(false);
  }

  async function handleRemoveCollaborator(userId: string) {
    await removeBoardCollaborator(boardId, userId);
    await loadData();
  }

  async function handleCancelInvite(inviteId: string) {
    await cancelBoardInvite(inviteId);
    await loadData();
  }

  async function handleRegenerateLink(email: string, name?: string) {
    const result = await generateInviteLink(email, name);
    if (result.inviteLink) {
      try {
        await navigator.clipboard.writeText(result.inviteLink);
      } catch {
        setSuccess(`Invite link: ${result.inviteLink}`);
      }
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onMouseDown={e => {
        if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        style={{
          background: theme.border,
          border: `1px solid ${theme.borderSubtle}`,
          borderRadius: 8,
          padding: '20px 24px',
          maxWidth: 420,
          width: '90%',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
          maxHeight: '80vh',
          overflow: 'auto',
        }}
      >
        {/* Header with live indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: theme.secondary }}>
            Collaborate
          </h3>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 10,
            background: 'rgba(74, 222, 128, 0.12)',
          }}>
            <div style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#4ade80',
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Live
            </span>
          </div>
        </div>

        <p style={{ margin: '0 0 16px', fontSize: 11, color: theme.textMuted }}>
          {boardName}
        </p>

        {/* Invite form (owner only) */}
        {isOwner && (
          <div style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: theme.textMuted,
              marginBottom: 6,
            }}>
              Invite people
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <input
                type="text"
                placeholder="Name (optional)"
                value={inviteName}
                onChange={e => setInviteName(e.target.value)}
                onKeyDown={e => e.stopPropagation()}
                style={{
                  width: '40%',
                  padding: '6px 10px',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  border: `1px solid ${theme.borderSubtle}`,
                  borderRadius: 4,
                  background: theme.surface,
                  color: theme.secondary,
                  outline: 'none',
                }}
              />
              <input
                ref={emailRef}
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleInvite(); e.stopPropagation(); }}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  border: `1px solid ${theme.borderSubtle}`,
                  borderRadius: 4,
                  background: theme.surface,
                  color: theme.secondary,
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <select
                value={permission}
                onChange={e => setPermission(e.target.value as 'view' | 'edit')}
                style={{
                  padding: '6px 8px',
                  fontSize: 11,
                  fontFamily: 'inherit',
                  border: `1px solid ${theme.borderSubtle}`,
                  borderRadius: 4,
                  background: theme.surface,
                  color: theme.secondary,
                  cursor: 'pointer',
                }}
              >
                <option value="edit">Can edit</option>
                <option value="view">Can view</option>
              </select>
              <button
                onClick={handleInvite}
                disabled={sending || !email.trim()}
                style={{
                  padding: '6px 14px',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  fontWeight: 600,
                  border: `1px solid ${theme.highlight}`,
                  borderRadius: 4,
                  background: hexToRgba(theme.highlight, 0.15),
                  color: theme.highlight,
                  cursor: sending ? 'wait' : 'pointer',
                  opacity: !email.trim() ? 0.5 : 1,
                }}
              >
                {sending ? '...' : 'Invite'}
              </button>
              <button
                onClick={handleCopyLink}
                disabled={sending || !email.trim()}
                style={{
                  padding: '6px 14px',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  fontWeight: 600,
                  border: `1px solid ${theme.highlight}`,
                  borderRadius: 4,
                  background: 'transparent',
                  color: theme.highlight,
                  cursor: sending ? 'wait' : 'pointer',
                  opacity: !email.trim() ? 0.5 : 1,
                }}
              >
                {sending ? '...' : 'Copy Link'}
              </button>
            </div>
            {error && <p style={{ margin: 0, fontSize: 11, color: '#f87171' }}>{error}</p>}
            {success && <p style={{ margin: 0, fontSize: 11, color: '#4ade80' }}>{success}</p>}
          </div>
        )}

        {/* Current collaborators */}
        {collaborators.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.textMuted, marginBottom: 6 }}>
              Collaborators
            </div>
            {collaborators.map(c => (
              <div
                key={c.user_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  borderBottom: `1px solid ${theme.borderSubtle}`,
                }}
              >
                <div>
                  <span style={{ fontSize: 12, color: theme.secondary }}>
                    {c.profile?.display_name ?? c.profile?.email ?? 'Unknown'}
                  </span>
                  <span style={{ fontSize: 10, color: theme.textMuted, marginLeft: 8 }}>
                    {c.permission}
                  </span>
                </div>
                {isOwner && (
                  <button
                    onClick={() => handleRemoveCollaborator(c.user_id)}
                    style={{
                      fontSize: 10,
                      fontFamily: 'inherit',
                      border: 'none',
                      background: 'transparent',
                      color: '#f87171',
                      cursor: 'pointer',
                      padding: '2px 6px',
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pending invites */}
        {isOwner && pendingInvites.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.textMuted, marginBottom: 6 }}>
              Pending Invites
            </div>
            {pendingInvites.map(inv => (
              <PendingBoardInviteRow
                key={inv.id}
                invite={inv}
                onCancel={() => handleCancelInvite(inv.id)}
                onCopyLink={() => handleRegenerateLink(inv.invitee_email, inv.invitee_name ?? undefined)}
              />
            ))}
          </div>
        )}

        {/* No collaborators message */}
        {collaborators.length === 0 && pendingInvites.length === 0 && isOwner && (
          <p style={{ fontSize: 12, color: theme.textMuted, margin: '0 0 16px' }}>
            No one else has access yet. Invite people to collaborate in real time.
          </p>
        )}

        {/* Close button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              fontSize: 12,
              fontFamily: 'inherit',
              border: `1px solid ${theme.borderSubtle}`,
              borderRadius: 4,
              background: 'transparent',
              color: theme.textMuted,
              cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = theme.borderSubtle; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
