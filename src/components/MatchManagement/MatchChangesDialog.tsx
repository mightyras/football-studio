import { useState, useMemo, useEffect } from 'react';
import { useAppState } from '../../state/AppStateContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import { hexToRgba } from '../../utils/colorUtils';
import { computeMatchStateAtMinute, validateSubstitution, getSubbedOffPlayerIds } from '../../utils/matchComputation';
import type {
  MatchEvent,
  MatchSubstitutionEvent,
  PlayerRoleAssignment,
} from '../../types/matchManagement';
import type { PositionRole, SubstitutePlayer } from '../../types';

const ALL_ROLES: PositionRole[] = [
  'GK', 'CB', 'LCB', 'RCB', 'LB', 'RB', 'FB', 'WB', 'DM', 'CM', 'OM', 'CF', 'LW', 'RW',
];

interface PendingSub {
  playerOutId: string;
  playerInId: string;
}

interface MatchChangesDialogProps {
  onClose: () => void;
}

export function MatchChangesDialog({ onClose }: MatchChangesDialogProps) {
  const { state, dispatch } = useAppState();
  const theme = useThemeColors();

  const plan = state.matchPlan;
  const minute = state.matchCurrentMinute;

  // Find existing events at this minute (for pre-populating the dialog)
  const existingEventsAtMinute = useMemo(
    () => plan ? plan.events.filter(e => e.minute === minute) : [],
    [plan, minute],
  );

  // Plan without events at this minute — used for computing baseline state
  // and for validation (so existing events at this minute don't block re-saving)
  const planWithout = useMemo(
    () => plan ? { ...plan, events: plan.events.filter(e => e.minute !== minute) } : null,
    [plan, minute],
  );

  // Compute baseline state BEFORE events at this minute (so we can edit them)
  const matchState = useMemo(() => {
    if (!planWithout) return null;
    return computeMatchStateAtMinute(planWithout, minute);
  }, [planWithout, minute]);

  // Pending changes — pre-populated from existing events at this minute
  const [pendingSubs, setPendingSubs] = useState<PendingSub[]>(() =>
    existingEventsAtMinute
      .filter((e): e is MatchSubstitutionEvent => e.type === 'substitution')
      .map(e => ({ playerOutId: e.playerOutId, playerInId: e.playerInId })),
  );
  const [pendingRoleChanges, setPendingRoleChanges] = useState<Map<string, PositionRole>>(() => {
    const map = new Map<string, PositionRole>();
    for (const e of existingEventsAtMinute) {
      if (e.type === 'substitution' && e.assignedRole) map.set(e.playerInId, e.assignedRole);
      if (e.type === 'position-change') map.set(e.playerId, e.toRole);
    }
    return map;
  });
  const [selectedBench, setSelectedBench] = useState<string | null>(null);
  const [editingRoleFor, setEditingRoleFor] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!plan || !matchState) return null;

  // Compute preview lineup by applying pending subs + role changes
  const preview = useMemo(() => {
    let onPitch = [...matchState.onPitch];
    let bench = [...matchState.bench];

    for (const sub of pendingSubs) {
      const outIdx = onPitch.findIndex(p => p.playerId === sub.playerOutId);
      const inIdx = bench.findIndex(s => s.id === sub.playerInId);
      if (outIdx === -1 || inIdx === -1) continue;

      const outPlayer = onPitch[outIdx];
      const inPlayer = bench[inIdx];

      // Incoming player gets outgoing player's role
      const newOnPitch: PlayerRoleAssignment = {
        playerId: inPlayer.id,
        number: inPlayer.number,
        name: inPlayer.name,
        role: outPlayer.role,
        isGK: outPlayer.isGK,
      };

      // Outgoing player goes to bench
      const newBench: SubstitutePlayer = {
        id: outPlayer.playerId,
        team: 'A',
        number: outPlayer.number,
        name: outPlayer.name,
      };

      onPitch = [...onPitch];
      onPitch[outIdx] = newOnPitch;
      bench = bench.filter((_, i) => i !== inIdx);
      bench = [...bench, newBench];
    }

    // Apply role changes
    if (pendingRoleChanges.size > 0) {
      onPitch = onPitch.map(p => {
        const newRole = pendingRoleChanges.get(p.playerId);
        return newRole ? { ...p, role: newRole } : p;
      });
    }

    return { onPitch, bench };
  }, [matchState, pendingSubs, pendingRoleChanges]);

  // Validation: use planWithout so existing events at this minute don't block re-saving
  const pendingSubCount = pendingSubs.length;
  const validation = validateSubstitution(planWithout!, minute);
  // For multiple subs, we need to check the total
  const totalSubsAfter = matchState.subsUsed + pendingSubCount;
  const maxSubs = plan.hasExtraTime ? 6 : 5;
  const canAddMoreSubs = plan.ruleMode === 'free' || (
    validation.allowed && totalSubsAfter < maxSubs
  );

  // Players already used in pending subs
  const usedBenchIds = new Set(pendingSubs.map(s => s.playerInId));
  const usedPitchIds = new Set(pendingSubs.map(s => s.playerOutId));

  // Under FIFA rules, players who were subbed off cannot return
  const subbedOffIds = useMemo(
    () => plan.ruleMode === 'fifa-standard'
      ? getSubbedOffPlayerIds(planWithout!.events, minute)
      : new Set<string>(),
    [plan.ruleMode, planWithout, minute],
  );

  // Available bench/pitch for next sub
  const availableBench = matchState.bench.filter(
    s => !usedBenchIds.has(s.id) && !subbedOffIds.has(s.id),
  );
  // Ineligible bench players (subbed off under FIFA rules) — shown greyed out
  const ineligibleBench = plan.ruleMode === 'fifa-standard'
    ? matchState.bench.filter(s => !usedBenchIds.has(s.id) && subbedOffIds.has(s.id))
    : [];
  const availablePitch = matchState.onPitch.filter(p => !usedPitchIds.has(p.playerId));

  const handleSelectBench = (id: string) => {
    setSelectedBench(id === selectedBench ? null : id);
  };

  const handleSelectPitch = (playerId: string) => {
    if (!selectedBench) return;
    // Create sub pair
    setPendingSubs(prev => [...prev, { playerOutId: playerId, playerInId: selectedBench }]);
    setSelectedBench(null);
  };

  const handleRemoveSub = (index: number) => {
    setPendingSubs(prev => prev.filter((_, i) => i !== index));
    // Also remove any role change for the incoming player
    const sub = pendingSubs[index];
    if (sub) {
      setPendingRoleChanges(prev => {
        const next = new Map(prev);
        next.delete(sub.playerInId);
        return next;
      });
    }
  };

  const handleRoleChange = (playerId: string, newRole: PositionRole) => {
    setPendingRoleChanges(prev => {
      const next = new Map(prev);
      // Check if this is reverting to original role
      const originalPlayer = matchState.onPitch.find(p => p.playerId === playerId);
      // For subbed-in players, find their inherited role
      const sub = pendingSubs.find(s => s.playerInId === playerId);
      const originalRole = sub
        ? matchState.onPitch.find(p => p.playerId === sub.playerOutId)?.role
        : originalPlayer?.role;

      if (newRole === originalRole) {
        next.delete(playerId);
      } else {
        next.set(playerId, newRole);
      }
      return next;
    });
    setEditingRoleFor(null);
  };

  const handleConfirmAll = () => {
    const newEvents: MatchEvent[] = [];

    // Build sub events — if a subbed-in player also has a role change,
    // embed the final role directly via assignedRole (no phantom position)
    for (const sub of pendingSubs) {
      const roleOverride = pendingRoleChanges.get(sub.playerInId);
      newEvents.push({
        type: 'substitution',
        id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        minute,
        playerOutId: sub.playerOutId,
        playerInId: sub.playerInId,
        ...(roleOverride ? { assignedRole: roleOverride } : {}),
      });
    }

    // Build position-change events only for players NOT already handled by assignedRole
    for (const [playerId, newRole] of pendingRoleChanges) {
      // Skip subbed-in players — their role is already embedded in the sub event
      if (pendingSubs.some(s => s.playerInId === playerId)) continue;

      // Find the player's current role
      const fromRole = matchState!.onPitch.find(p => p.playerId === playerId)?.role ?? 'CM';

      if (fromRole !== newRole) {
        newEvents.push({
          type: 'position-change',
          id: `pos-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          minute,
          playerId,
          fromRole,
          toRole: newRole,
        });
      }
    }

    // Atomically replace all events at this minute
    dispatch({ type: 'REPLACE_MATCH_EVENTS_AT_MINUTE', minute, events: newEvents });
    onClose();
  };

  const isClearing = existingEventsAtMinute.length > 0 && pendingSubs.length === 0 && pendingRoleChanges.size === 0;
  const hasChanges = pendingSubs.length > 0 || pendingRoleChanges.size > 0 || isClearing;

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
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: 8,
          padding: 0,
          width: 400,
          maxHeight: '85vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: `1px solid ${theme.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: theme.secondary }}>
            {existingEventsAtMinute.length > 0 ? 'Edit' : ''} Changes at {minute}&prime;
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: theme.textSubtle,
              cursor: 'pointer',
              fontSize: 16,
              padding: '0 4px',
            }}
          >
            ×
          </button>
        </div>

        {/* Validation warning */}
        {!validation.allowed && pendingSubs.length === 0 && (
          <div
            style={{
              padding: '8px 16px',
              background: hexToRgba('#ef4444', 0.1),
              borderBottom: `1px solid ${hexToRgba('#ef4444', 0.2)}`,
              fontSize: 11,
              color: '#ef4444',
            }}
          >
            {validation.reason}
          </div>
        )}

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>

          {/* ── Substitutions Section ── */}
          {availableBench.length > 0 || pendingSubs.length > 0 ? (
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${theme.border}` }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: theme.highlight,
                  marginBottom: 8,
                }}
              >
                Substitutions
              </div>

              {/* Pending sub pairs */}
              {pendingSubs.length > 0 && (
                <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {pendingSubs.map((sub, i) => {
                    const outPlayer = matchState.onPitch.find(p => p.playerId === sub.playerOutId);
                    const inPlayer = matchState.bench.find(s => s.id === sub.playerInId);
                    if (!outPlayer || !inPlayer) return null;
                    return (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 8px',
                          background: hexToRgba(theme.highlight, 0.06),
                          borderRadius: 4,
                          fontSize: 11,
                        }}
                      >
                        <span style={{ color: '#22c55e', fontWeight: 600, fontSize: 9 }}>IN</span>
                        <span style={{ color: theme.secondary }}>
                          #{inPlayer.number} {inPlayer.name}
                        </span>
                        <span style={{ color: theme.textSubtle }}>←</span>
                        <span style={{ color: '#ef4444', fontWeight: 600, fontSize: 9 }}>OUT</span>
                        <span style={{ color: theme.secondary }}>
                          #{outPlayer.number} {outPlayer.name}
                        </span>
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: '#60a5fa',
                            background: 'rgba(59, 130, 246, 0.2)',
                            padding: '1px 5px',
                            borderRadius: 3,
                          }}
                        >
                          {outPlayer.role}
                        </span>
                        <button
                          onClick={() => handleRemoveSub(i)}
                          style={{
                            marginLeft: 'auto',
                            background: 'none',
                            border: 'none',
                            color: theme.textSubtle,
                            cursor: 'pointer',
                            fontSize: 14,
                            padding: '0 2px',
                            flexShrink: 0,
                          }}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add more subs */}
              {canAddMoreSubs && availableBench.length > 0 && (
                <>
                  {/* Bench players (IN) */}
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: '#22c55e',
                      marginBottom: 4,
                    }}
                  >
                    {selectedBench ? 'Now select player to sub OUT' : 'Select from bench (IN)'}
                  </div>

                  {!selectedBench ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 8 }}>
                      {availableBench.map(s => (
                        <button
                          key={s.id}
                          onClick={() => handleSelectBench(s.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 8px',
                            border: `1px solid ${theme.borderSubtle}`,
                            borderRadius: 4,
                            background: 'transparent',
                            color: theme.secondary,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            fontSize: 10,
                            transition: 'all 0.1s',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = '#22c55e';
                            e.currentTarget.style.color = '#22c55e';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = theme.borderSubtle;
                            e.currentTarget.style.color = theme.secondary;
                          }}
                        >
                          <div
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: '50%',
                              background: state.teamAColor,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 8,
                              fontWeight: 700,
                              color: '#fff',
                              flexShrink: 0,
                            }}
                          >
                            {s.number}
                          </div>
                          {s.name}
                        </button>
                      ))}
                      {/* Ineligible bench players — subbed off under FIFA rules */}
                      {ineligibleBench.map(s => (
                        <div
                          key={s.id}
                          title="Player was already subbed off (FIFA rules)"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 8px',
                            border: `1px solid ${theme.borderSubtle}`,
                            borderRadius: 4,
                            background: 'transparent',
                            opacity: 0.35,
                            fontFamily: 'inherit',
                            fontSize: 10,
                            color: theme.textSubtle,
                          }}
                        >
                          <div
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: '50%',
                              background: state.teamAColor,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 8,
                              fontWeight: 700,
                              color: '#fff',
                              flexShrink: 0,
                              opacity: 0.5,
                            }}
                          >
                            {s.number}
                          </div>
                          {s.name}
                          <span style={{ fontSize: 8, fontStyle: 'italic', color: '#ef4444' }}>
                            subbed off
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      {/* Show selected bench player */}
                      <div style={{ marginBottom: 6 }}>
                        {(() => {
                          const sel = matchState.bench.find(s => s.id === selectedBench);
                          if (!sel) return null;
                          return (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '4px 8px',
                                background: hexToRgba('#22c55e', 0.1),
                                border: '1px solid #22c55e40',
                                borderRadius: 4,
                                fontSize: 11,
                              }}
                            >
                              <span style={{ color: '#22c55e', fontWeight: 600, fontSize: 9 }}>IN</span>
                              <div
                                style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: '50%',
                                  background: state.teamAColor,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 8,
                                  fontWeight: 700,
                                  color: '#fff',
                                }}
                              >
                                {sel.number}
                              </div>
                              <span style={{ color: theme.secondary }}>{sel.name}</span>
                              <button
                                onClick={() => setSelectedBench(null)}
                                style={{
                                  marginLeft: 'auto',
                                  background: 'none',
                                  border: 'none',
                                  color: theme.textSubtle,
                                  cursor: 'pointer',
                                  fontSize: 12,
                                  padding: '0 2px',
                                }}
                              >
                                ×
                              </button>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Pitch players to sub out */}
                      <div
                        style={{
                          fontSize: 9,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: '#ef4444',
                          marginBottom: 4,
                        }}
                      >
                        Select player to sub OUT
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {availablePitch.map(p => (
                          <button
                            key={p.playerId}
                            onClick={() => handleSelectPitch(p.playerId)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '3px 8px',
                              border: `1px solid ${theme.borderSubtle}`,
                              borderRadius: 4,
                              background: 'transparent',
                              color: theme.secondary,
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              fontSize: 10,
                              transition: 'all 0.1s',
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.borderColor = '#ef4444';
                              e.currentTarget.style.color = '#ef4444';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.borderColor = theme.borderSubtle;
                              e.currentTarget.style.color = theme.secondary;
                            }}
                          >
                            <div
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: '50%',
                                background: state.teamAColor,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 8,
                                fontWeight: 700,
                                color: '#fff',
                                flexShrink: 0,
                              }}
                            >
                              {p.number}
                            </div>
                            {p.name}
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                color: '#60a5fa',
                                background: 'rgba(59, 130, 246, 0.2)',
                                padding: '1px 5px',
                                borderRadius: 3,
                              }}
                            >
                              {p.role}
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          ) : null}

          {/* ── Resulting Lineup ── */}
          <div style={{ padding: '12px 16px' }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#3b82f6',
                marginBottom: 8,
              }}
            >
              {pendingSubs.length > 0 ? 'Resulting Lineup' : 'Lineup'}{' '}
              <span style={{ color: theme.textSubtle, fontWeight: 400, textTransform: 'none' }}>
                (tap role to change)
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {preview.onPitch.map(p => {
                const isSubbedIn = pendingSubs.some(s => s.playerInId === p.playerId);
                const hasRoleChange = pendingRoleChanges.has(p.playerId);
                const originalRole = (() => {
                  const sub = pendingSubs.find(s => s.playerInId === p.playerId);
                  if (sub) return matchState.onPitch.find(op => op.playerId === sub.playerOutId)?.role;
                  return matchState.onPitch.find(op => op.playerId === p.playerId)?.role;
                })();
                const isEditingRole = editingRoleFor === p.playerId;

                return (
                  <div key={p.playerId}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '4px 8px',
                        borderRadius: 4,
                        background: isSubbedIn
                          ? hexToRgba('#22c55e', 0.06)
                          : 'transparent',
                      }}
                    >
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: state.teamAColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 8,
                          fontWeight: 700,
                          color: '#fff',
                          flexShrink: 0,
                        }}
                      >
                        {p.number}
                      </div>
                      <span style={{ fontSize: 11, color: theme.secondary, flex: 1 }}>
                        {p.name || `Player #${p.number}`}
                      </span>
                      {isSubbedIn && (
                        <span style={{ fontSize: 9, color: '#22c55e', fontWeight: 600 }}>NEW</span>
                      )}
                      {/* Role badge — clickable */}
                      <button
                        onClick={() => setEditingRoleFor(isEditingRole ? null : p.playerId)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '2px 8px',
                          border: 'none',
                          borderRadius: 4,
                          background: hasRoleChange
                            ? 'rgba(59, 130, 246, 0.25)'
                            : 'rgba(59, 130, 246, 0.12)',
                          color: '#60a5fa',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          fontSize: 10,
                          fontWeight: 700,
                          minWidth: 28,
                          textAlign: 'center',
                          flexShrink: 0,
                          transition: 'all 0.1s',
                        }}
                      >
                        {hasRoleChange && originalRole ? (
                          <>
                            <span style={{ color: theme.textSubtle, textDecoration: 'line-through', fontWeight: 400 }}>
                              {originalRole}
                            </span>
                            <span>→</span>
                            {p.role}
                          </>
                        ) : (
                          p.role
                        )}
                      </button>
                      {/* Reset role change button */}
                      {hasRoleChange && (
                        <button
                          onClick={() => {
                            setPendingRoleChanges(prev => {
                              const next = new Map(prev);
                              next.delete(p.playerId);
                              return next;
                            });
                            setEditingRoleFor(null);
                          }}
                          title="Revert role change"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: theme.textSubtle,
                            cursor: 'pointer',
                            fontSize: 12,
                            padding: '0 2px',
                            flexShrink: 0,
                            lineHeight: 1,
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>

                    {/* Inline role picker */}
                    {isEditingRole && (
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 3,
                          padding: '6px 8px 6px 36px',
                        }}
                      >
                        {ALL_ROLES.filter(r => r !== p.role).map(role => (
                          <button
                            key={role}
                            onClick={() => handleRoleChange(p.playerId, role)}
                            style={{
                              padding: '2px 8px',
                              fontSize: 9,
                              fontWeight: 600,
                              fontFamily: 'inherit',
                              border: `1px solid ${theme.borderSubtle}`,
                              borderRadius: 3,
                              background: 'transparent',
                              color: theme.textMuted,
                              cursor: 'pointer',
                              transition: 'all 0.1s',
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.borderColor = '#3b82f6';
                              e.currentTarget.style.color = '#3b82f6';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.borderColor = theme.borderSubtle;
                              e.currentTarget.style.color = theme.textMuted;
                            }}
                          >
                            {role}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: `1px solid ${theme.border}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
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
            onClick={handleConfirmAll}
            disabled={!hasChanges}
            style={{
              padding: '6px 16px',
              fontSize: 11,
              fontFamily: 'inherit',
              fontWeight: 600,
              border: `1px solid ${theme.highlight}`,
              borderRadius: 4,
              background: hexToRgba(theme.highlight, 0.15),
              color: theme.highlight,
              cursor: hasChanges ? 'pointer' : 'not-allowed',
              opacity: hasChanges ? 1 : 0.4,
            }}
          >
            {isClearing ? 'Clear Changes' : 'Confirm All'}
          </button>
        </div>
      </div>
    </div>
  );
}
