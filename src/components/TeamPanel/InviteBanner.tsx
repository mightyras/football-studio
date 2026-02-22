import { useState, useEffect, useRef } from 'react';
import { useTeam } from '../../state/TeamContext';
import { useAuth } from '../../state/AuthContext';
import * as inviteService from '../../services/inviteService';
import { fetchMyBoardInvites, acceptBoardInvite } from '../../services/collaborationService';

/**
 * InviteBanner — auto-accepts all pending team & board invites on login.
 * No UI is shown unless there's a transient status message.
 */
export function InviteBanner() {
  const { pendingInvites, refresh } = useTeam();
  const { user } = useAuth();
  const [status, setStatus] = useState<string | null>(null);
  const accepting = useRef(false);

  useEffect(() => {
    if (!user || accepting.current) return;

    async function autoAcceptAll() {
      accepting.current = true;

      // Auto-accept team invites
      for (const inv of pendingInvites) {
        await inviteService.acceptInvite(inv.id);
      }

      // Fetch & auto-accept board invites
      const boardInvites = await fetchMyBoardInvites();
      for (const inv of boardInvites) {
        await acceptBoardInvite(inv.id);
      }

      const total = pendingInvites.length + boardInvites.length;
      if (total > 0) {
        setStatus(`Joined ${total} invite${total > 1 ? 's' : ''} automatically`);
        await refresh();
        setTimeout(() => setStatus(null), 3000);
      }

      accepting.current = false;
    }

    if (pendingInvites.length > 0) {
      autoAcceptAll();
    } else {
      // Still check board invites even if no team invites
      async function checkBoardInvites() {
        accepting.current = true;
        const boardInvites = await fetchMyBoardInvites();
        for (const inv of boardInvites) {
          await acceptBoardInvite(inv.id);
        }
        if (boardInvites.length > 0) {
          setStatus(`Joined ${boardInvites.length} board invite${boardInvites.length > 1 ? 's' : ''} automatically`);
          await refresh();
          setTimeout(() => setStatus(null), 3000);
        }
        accepting.current = false;
      }
      checkBoardInvites();
    }
  }, [user, pendingInvites, refresh]);

  if (!status) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 44,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1500,
        maxWidth: 420,
        width: '90%',
        background: '#16a34a',
        border: '1px solid #22c55e',
        borderRadius: 6,
        padding: '10px 14px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        fontSize: 12,
        color: '#fff',
        textAlign: 'center',
        fontWeight: 600,
      }}
    >
      {status}
    </div>
  );
}
