import { useState } from 'react';
import { useTeam } from '../../state/TeamContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import * as inviteService from '../../services/inviteService';

export function InviteBanner() {
  const { pendingInvites, refresh } = useTeam();
  const theme = useThemeColors();
  const [processing, setProcessing] = useState<string | null>(null);

  if (pendingInvites.length === 0) return null;

  async function handleAccept(inviteId: string) {
    setProcessing(inviteId);
    const ok = await inviteService.acceptInvite(inviteId);
    if (ok) {
      await refresh();
    }
    setProcessing(null);
  }

  async function handleDecline(inviteId: string) {
    setProcessing(inviteId);
    const ok = await inviteService.declineInvite(inviteId);
    if (ok) {
      await refresh();
    }
    setProcessing(null);
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 44,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1500,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        maxWidth: 420,
        width: '90%',
      }}
    >
      {pendingInvites.map((inv) => (
        <div
          key={inv.id}
          style={{
            background: theme.border,
            border: '1px solid #f59e0b',
            borderRadius: 6,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            fontSize: 12,
            color: theme.secondary,
          }}
        >
          <div style={{ flex: 1 }}>
            You've been invited to join a team
            {inv.role === 'admin' ? ' as admin' : ''}
          </div>
          <button
            disabled={processing === inv.id}
            onClick={() => handleAccept(inv.id)}
            style={{
              padding: '4px 10px',
              fontSize: 11,
              fontFamily: 'inherit',
              border: 'none',
              borderRadius: 4,
              background: '#f59e0b',
              color: theme.inputBg,
              fontWeight: 600,
              cursor: processing === inv.id ? 'default' : 'pointer',
              opacity: processing === inv.id ? 0.5 : 1,
            }}
          >
            Accept
          </button>
          <button
            disabled={processing === inv.id}
            onClick={() => handleDecline(inv.id)}
            style={{
              padding: '4px 10px',
              fontSize: 11,
              fontFamily: 'inherit',
              border: `1px solid ${theme.textSubtle}`,
              borderRadius: 4,
              background: 'transparent',
              color: theme.textMuted,
              cursor: processing === inv.id ? 'default' : 'pointer',
              opacity: processing === inv.id ? 0.5 : 1,
            }}
          >
            Decline
          </button>
        </div>
      ))}
    </div>
  );
}
