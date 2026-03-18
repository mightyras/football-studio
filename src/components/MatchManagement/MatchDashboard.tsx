import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAppState } from '../../state/AppStateContext';
import { useAuth } from '../../state/AuthContext';
import { useTeam } from '../../state/TeamContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useMatchAutoSave, type SyncStatus } from '../../hooks/useMatchAutoSave';
import { hexToRgba } from '../../utils/colorUtils';
import { computeMatchStateAtMinute, getTotalMinutes } from '../../utils/matchComputation';
import { FORMATIONS } from '../../constants/formations';
import { MatchPlayerRow } from './MatchPlayerRow';
import { MatchRuleConfig } from './MatchRuleConfig';
import { MatchExportDialog } from './MatchExportDialog';
import { MatchPlansBrowser } from './MatchPlansBrowser';
import * as matchPlanService from '../../services/matchPlanService';
import type { MatchPlanBoardContext, MatchPlanRow } from '../../services/matchPlanService';
import type { MatchSubstitutionEvent, MatchPositionChangeEvent, MatchPlan, MatchOpponent, MatchOwnKit, PlayerRoleAssignment } from '../../types/matchManagement';
import type { SubstitutePlayer, PositionRole } from '../../types';
import { ROLE_LABELS } from '../../types';

// ── Shared button style helper ──

function btnStyle(theme: ReturnType<typeof useThemeColors>, active = false) {
  return {
    fontSize: 12,
    fontFamily: 'inherit',
    padding: '5px 12px',
    border: `1px solid ${active ? theme.highlight : theme.borderSubtle}`,
    borderRadius: 3,
    background: active ? hexToRgba(theme.highlight, 0.1) : 'transparent',
    color: active ? theme.highlight : theme.textMuted,
    cursor: 'pointer' as const,
  };
}

// ═══════════════════════════════════════════
//  Landing Screen (no match loaded)
// ═══════════════════════════════════════════

function LandingScreen() {
  const { state, dispatch } = useAppState();
  const theme = useThemeColors();
  const [recentPlans, setRecentPlans] = useState<MatchPlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBrowser, setShowBrowser] = useState(false);
  const [showNewMatchDialog, setShowNewMatchDialog] = useState(false);
  const [newMatchName, setNewMatchName] = useState('');

  const refreshRecents = useCallback(async () => {
    setLoading(true);
    const plans = await matchPlanService.fetchMyMatchPlans();
    setRecentPlans(plans.slice(0, 5));
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const plans = await matchPlanService.fetchMyMatchPlans();
      if (!cancelled) {
        setRecentPlans(plans.slice(0, 5));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const openNewMatchDialog = useCallback(() => {
    setNewMatchName(`${state.teamAName} vs ${state.teamBName}`);
    setShowNewMatchDialog(true);
  }, [state.teamAName, state.teamBName]);

  const confirmNewMatch = useCallback(() => {
    const finalName = newMatchName.trim() || `${state.teamAName} vs ${state.teamBName}`;
    dispatch({ type: 'NEW_MATCH_PLAN', name: finalName });
    setShowNewMatchDialog(false);
  }, [newMatchName, state.teamAName, state.teamBName, dispatch]);

  const handleLoadRecent = useCallback((row: MatchPlanRow) => {
    dispatch({ type: 'LOAD_MATCH_PLAN', plan: row.data, cloudId: row.id });
  }, [dispatch]);

  function timeAgo(dateStr: string): string {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks}w ago`;
    return new Date(dateStr).toLocaleDateString();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {/* Header */}
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: theme.secondary,
          marginBottom: 12,
        }}>
          Match Management
        </div>

        {/* Description */}
        <div style={{ fontSize: 12, color: theme.textSubtle, marginBottom: 12, lineHeight: 1.4 }}>
          Create a new match from your current board setup.
        </div>

        {/* New Match button */}
        <button
          onClick={openNewMatchDialog}
          style={{
            width: '100%',
            padding: '8px 0',
            fontSize: 13,
            fontFamily: 'inherit',
            fontWeight: 600,
            border: `1px solid ${theme.highlight}`,
            borderRadius: 4,
            background: hexToRgba(theme.highlight, 0.1),
            color: theme.highlight,
            cursor: 'pointer',
            marginBottom: 20,
          }}
        >
          + New Match from Board
        </button>

        {/* Recent matches */}
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: theme.secondary,
          marginBottom: 8,
        }}>
          Recent Matches
        </div>

        {loading && (
          <div style={{ fontSize: 12, color: theme.textSubtle, textAlign: 'center', padding: 16 }}>
            Loading...
          </div>
        )}

        {!loading && recentPlans.length === 0 && (
          <div style={{ fontSize: 12, color: theme.textSubtle, textAlign: 'center', padding: 16 }}>
            No saved matches yet.
          </div>
        )}

        {!loading && recentPlans.map(row => (
          <div
            key={row.id}
            onClick={() => handleLoadRecent(row)}
            style={{
              padding: '8px 10px',
              borderBottom: `1px solid ${theme.borderSubtle}`,
              cursor: 'pointer',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = hexToRgba(theme.highlight, 0.05); }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Color dots */}
              <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: row.board_context?.teamAColor ?? '#3b82f6',
                  border: '1px solid rgba(255,255,255,0.2)',
                }} />
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: row.board_context?.teamBColor ?? '#ef4444',
                  border: '1px solid rgba(255,255,255,0.2)',
                }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: theme.secondary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.name}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 2, fontSize: 11, color: theme.textSubtle, paddingLeft: 26 }}>
              <span>{row.board_context?.eventCount ?? 0} sub{(row.board_context?.eventCount ?? 0) !== 1 ? 's' : ''}</span>
              {row.board_context?.ruleMode && (
                <span style={{
                  padding: '0 4px',
                  borderRadius: 2,
                  background: hexToRgba(theme.highlight, 0.1),
                  color: theme.highlight,
                }}>
                  {row.board_context.ruleMode === 'fifa-standard' ? 'FIFA' : 'Free'}
                </span>
              )}
              <span style={{ marginLeft: 'auto' }}>{timeAgo(row.updated_at)}</span>
            </div>
          </div>
        ))}

        {/* Browse all link */}
        {!loading && recentPlans.length > 0 && (
          <button
            onClick={() => setShowBrowser(true)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '8px 0',
              fontSize: 12,
              fontFamily: 'inherit',
              background: 'none',
              border: 'none',
              color: theme.highlight,
              cursor: 'pointer',
              marginTop: 4,
            }}
          >
            Browse All Matches...
          </button>
        )}
      </div>

      {/* Exit button */}
      <div style={{ padding: '8px 12px', borderTop: `1px solid ${theme.border}`, flexShrink: 0 }}>
        <button
          onClick={() => dispatch({ type: 'EXIT_MATCH_MANAGEMENT' })}
          style={{
            width: '100%',
            padding: '6px 0',
            fontSize: 12,
            fontFamily: 'inherit',
            border: `1px solid ${theme.borderSubtle}`,
            borderRadius: 4,
            background: 'transparent',
            color: theme.textMuted,
            cursor: 'pointer',
          }}
        >
          Exit Match Management
        </button>
      </div>

      {/* New Match name dialog */}
      {showNewMatchDialog && createPortal(
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
            if (e.target === e.currentTarget) setShowNewMatchDialog(false);
          }}
          onKeyDown={e => {
            if (e.key === 'Escape') setShowNewMatchDialog(false);
          }}
        >
          <div
            style={{
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              borderRadius: 8,
              width: 360,
              padding: '20px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: theme.secondary, marginBottom: 16 }}>
              New Match
            </div>
            <label style={{ display: 'block', fontSize: 12, color: theme.textMuted, marginBottom: 6 }}>
              Match name
            </label>
            <input
              type="text"
              autoFocus
              value={newMatchName}
              onChange={e => setNewMatchName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && newMatchName.trim()) confirmNewMatch();
              }}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: 13,
                fontFamily: 'inherit',
                background: hexToRgba(theme.secondary, 0.08),
                border: `1px solid ${theme.borderSubtle}`,
                borderRadius: 4,
                color: theme.secondary,
                outline: 'none',
                boxSizing: 'border-box',
                marginBottom: 16,
              }}
              onFocus={e => e.target.select()}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowNewMatchDialog(false)}
                style={{
                  padding: '6px 14px',
                  fontSize: 12,
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
                onClick={confirmNewMatch}
                disabled={!newMatchName.trim()}
                style={{
                  padding: '6px 14px',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  fontWeight: 600,
                  border: `1px solid ${theme.highlight}`,
                  borderRadius: 4,
                  background: hexToRgba(theme.highlight, 0.15),
                  color: theme.highlight,
                  cursor: newMatchName.trim() ? 'pointer' : 'default',
                  opacity: newMatchName.trim() ? 1 : 0.4,
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {showBrowser && createPortal(
        <MatchPlansBrowser onClose={() => { setShowBrowser(false); refreshRecents(); }} />,
        document.body,
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  Sync Status Indicator
// ═══════════════════════════════════════════

function SyncIndicator({ status }: { status: SyncStatus }) {
  const theme = useThemeColors();
  const text = status === 'saving' ? 'Saving...'
    : status === 'saved' ? 'Auto-saved \u2713'
    : status === 'error' ? 'Save failed'
    : null;

  return (
    <div style={{
      height: 16,
      fontSize: 11,
      color: status === 'error' ? '#ef4444'
        : status === 'saved' ? '#22c55e'
        : theme.textSubtle,
      lineHeight: '16px',
      overflow: 'hidden',
    }}>
      {text}
    </div>
  );
}

// ═══════════════════════════════════════════
//  Active Match UI (match loaded)
// ═══════════════════════════════════════════

function ActiveMatchUI() {
  const { state, dispatch } = useAppState();
  const { user } = useAuth();
  const theme = useThemeColors();
  const { syncStatus } = useMatchAutoSave();
  const [showConfig, setShowConfig] = useState(false);
  const [showMatchSetup, setShowMatchSetup] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showBrowser, setShowBrowser] = useState(false);
  const [swappedIds, setSwappedIds] = useState<string[]>([]);

  // Clear swap flash after animation
  useEffect(() => {
    if (swappedIds.length > 0) {
      const timer = setTimeout(() => setSwappedIds([]), 600);
      return () => clearTimeout(timer);
    }
  }, [swappedIds]);

  const plan = state.matchPlan!;
  const minute = state.matchCurrentMinute;
  const cloudId = state.matchPlanCloudId;
  const totalMinutes = getTotalMinutes(plan);

  // Auto-create in Supabase when we have a plan but no cloudId.
  // Guard ref prevents double-creation from React StrictMode re-firing effects.
  const creatingRef = useRef<string | null>(null);
  useEffect(() => {
    if (plan && !cloudId && user && creatingRef.current !== plan.id) {
      creatingRef.current = plan.id;
      (async () => {
        const formationName = FORMATIONS.find(f => f.id === state.teamAFormation)?.name ?? null;
        const boardContext: MatchPlanBoardContext = {
          teamAName: plan.ownKit?.name ?? state.teamAName,
          teamBName: plan.opponent?.name ?? state.teamBName,
          teamAColor: plan.ownKit?.color ?? state.teamAColor,
          teamBColor: plan.opponent?.color ?? state.teamBColor,
          formationName,
          eventCount: plan.events.length,
          ruleMode: plan.ruleMode,
        };
        const row = await matchPlanService.createMatchPlan(
          plan.name ?? `${boardContext.teamAName} vs ${boardContext.teamBName}`,
          plan,
          boardContext,
        );
        if (row) {
          dispatch({ type: 'SET_MATCH_PLAN_CLOUD_ID', cloudId: row.id, planName: row.name });
        }
      })();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id]); // only on new plan creation

  const matchState = useMemo(
    () => computeMatchStateAtMinute(plan, minute),
    [plan, minute],
  );

  const subEvents = plan.events.filter(
    (e): e is MatchSubstitutionEvent => e.type === 'substitution',
  );
  const posChangeEvents = plan.events.filter(
    (e): e is MatchPositionChangeEvent => {
      if (e.type !== 'position-change') return false;
      const subbedInAtSameMinute = subEvents.some(
        s => s.playerInId === e.playerId && s.minute === e.minute,
      );
      return !subbedInAtSameMinute;
    },
  );

  const allPosChanges = useMemo(() => {
    const implicit = getImplicitPosChangesFromSubs(plan, subEvents);
    return [...posChangeEvents, ...implicit].sort((a, b) => a.minute - b.minute);
  }, [plan, posChangeEvents, subEvents]);

  const getSubMinute = (playerId: string): number | undefined => {
    const subIn = subEvents.find(e => e.playerInId === playerId);
    if (subIn) return subIn.minute;
    const subOut = subEvents.find(e => e.playerOutId === playerId);
    if (subOut) return subOut.minute;
    return undefined;
  };

  const isStarter = (playerId: string) =>
    plan.startingLineup.some(p => p.playerId === playerId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{
            fontSize: 13,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: theme.secondary,
          }}>
            Match Management
          </span>
        </div>

        {/* Plan name */}
        {plan.name && (
          <div style={{
            fontSize: 13,
            fontWeight: 600,
            color: theme.secondary,
            marginBottom: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {plan.name}
          </div>
        )}

        {/* Sync indicator */}
        <SyncIndicator status={syncStatus} />

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setShowExportDialog(true)} style={btnStyle(theme)}>Share</button>
          <button
            onClick={() => setShowConfig(p => !p)}
            title={showConfig ? 'Hide config' : 'Show config'}
            style={{ ...btnStyle(theme, showConfig), fontSize: 18, padding: '2px 10px', lineHeight: 1 }}
          >
            &#9881;
          </button>
        </div>
      </div>

      {/* Config section */}
      {showConfig && (
        <div style={{ borderBottom: `1px solid ${theme.border}`, flexShrink: 0 }}>
          <MatchRuleConfig />
        </div>
      )}

      {/* Match Setup section (at minute 0) */}
      {minute === 0 && (
        <div style={{ borderBottom: `1px solid ${theme.border}`, flexShrink: 0 }}>
          <button
            onClick={() => setShowMatchSetup(p => !p)}
            style={{
              width: '100%',
              padding: '6px 12px',
              fontSize: 12,
              fontFamily: 'inherit',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              border: 'none',
              background: 'transparent',
              color: showMatchSetup ? theme.highlight : theme.textSubtle,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            {showMatchSetup ? '\u25BE' : '\u25B8'} Match Setup
          </button>
          {showMatchSetup && (
            <MatchSetupSection
              plan={plan}
              teamAName={state.teamAName}
              teamBName={state.teamBName}
              onOpponentChange={(opponent: MatchOpponent) => dispatch({ type: 'SET_MATCH_OPPONENT', opponent })}
              onOwnKitChange={(kit: MatchOwnKit) => dispatch({ type: 'SET_MATCH_OWN_KIT', kit })}
            />
          )}
        </div>
      )}

      {/* Summary bar */}
      <div style={{
        padding: '6px 12px',
        display: 'flex',
        gap: 12,
        fontSize: 12,
        borderBottom: `1px solid ${theme.border}`,
        flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        <span style={{ color: theme.textMuted }}>
          Minute: <strong style={{ color: theme.secondary }}>{minute}&prime;</strong>
        </span>
        {plan.ruleMode === 'fifa-standard' && (
          <>
            <span style={{ color: theme.textMuted }}>
              Subs: <strong style={{ color: matchState.subsRemaining === 0 ? '#ef4444' : theme.secondary }}>
                {matchState.subsUsed}/{plan.hasExtraTime ? 6 : 5}
              </strong>
            </span>
            <span style={{ color: theme.textMuted }}>
              Windows: <strong style={{ color: matchState.windowsRemaining === 0 ? '#ef4444' : theme.secondary }}>
                {matchState.windowsUsed}/{plan.hasExtraTime ? 4 : 3}
              </strong>
            </span>
          </>
        )}
        {plan.ruleMode === 'free' && (
          <span style={{ color: theme.textMuted }}>
            Subs: <strong style={{ color: theme.secondary }}>{matchState.subsUsed}</strong>
          </span>
        )}
      </div>

      {/* Player lists */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* On Pitch / Starting */}
        <div
          style={{
            padding: '6px 12px 2px',
            fontSize: 13,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: theme.textSubtle,
          }}
          onDragOver={minute === 0 ? (e => { e.preventDefault(); e.currentTarget.style.background = hexToRgba(theme.highlight, 0.05); }) : undefined}
          onDragLeave={minute === 0 ? (e => { e.currentTarget.style.background = ''; }) : undefined}
          onDrop={minute === 0 ? (e => {
            e.preventDefault();
            e.currentTarget.style.background = '';
            try {
              const data = JSON.parse(e.dataTransfer.getData('text/plain'));
              if (data.source === 'bench') {
                // Move bench player to starting lineup
                const benchPlayer = plan.startingBench.find(b => b.id === data.id);
                if (!benchPlayer) return;
                const newStarter: PlayerRoleAssignment = {
                  playerId: benchPlayer.id,
                  number: benchPlayer.number,
                  name: benchPlayer.name,
                  role: 'CM',
                };
                dispatch({ type: 'UPDATE_MATCH_LINEUP_AND_BENCH', lineup: [...plan.startingLineup, newStarter], bench: plan.startingBench.filter(b => b.id !== data.id) });
              }
            } catch { /* ignore invalid drag data */ }
          }) : undefined}
        >
          {minute === 0 ? 'Starting' : 'On Pitch'} ({matchState.onPitch.length})
        </div>
        {matchState.onPitch.map(p => (
          <MatchPlayerRow
            key={p.playerId}
            number={p.number}
            name={p.name}
            role={p.role}
            minutesPlayed={matchState.minutesPlayed[p.playerId] ?? 0}
            totalMinutes={totalMinutes}
            positionHistory={matchState.positionHistory[p.playerId] ?? []}
            isOnPitch={true}
            teamColor={state.teamAColor}
            subMinute={!isStarter(p.playerId) ? getSubMinute(p.playerId) : undefined}
            flash={swappedIds.includes(p.playerId)}
            editable={minute === 0}
            onEdit={minute === 0 ? ((field, value) => {
              const updatedLineup = plan.startingLineup.map(lp => {
                if (lp.playerId !== p.playerId) return lp;
                if (field === 'number') return { ...lp, number: parseInt(value) || lp.number };
                return { ...lp, name: value };
              });
              dispatch({ type: 'UPDATE_MATCH_LINEUP', lineup: updatedLineup });
            }) : undefined}
            draggable={minute === 0}
            onDragStart={minute === 0 ? (e => {
              e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'starting', id: p.playerId }));
              e.dataTransfer.effectAllowed = 'move';
              if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = '0.4';
            }) : undefined}
            onDragOver={minute === 0 ? (e => {
              e.preventDefault();
              e.stopPropagation();
            }) : undefined}
            onDragLeave={minute === 0 ? (e => {
              e.stopPropagation();
            }) : undefined}
            onDrop={minute === 0 ? (e => {
              e.preventDefault();
              e.stopPropagation();
              try {
                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                if (data.source === 'starting' && data.id !== p.playerId) {
                  // Swap player identity between two role slots (keeps roles/positions fixed)
                  const idxA = plan.startingLineup.findIndex(lp => lp.playerId === data.id);
                  const idxB = plan.startingLineup.findIndex(lp => lp.playerId === p.playerId);
                  if (idxA === -1 || idxB === -1) return;
                  const a = plan.startingLineup[idxA];
                  const b = plan.startingLineup[idxB];
                  const updatedLineup = [...plan.startingLineup];
                  // Swap playerId/number/name but keep role/isGK at their positions
                  updatedLineup[idxA] = { ...a, playerId: b.playerId, number: b.number, name: b.name };
                  updatedLineup[idxB] = { ...b, playerId: a.playerId, number: a.number, name: a.name };
                  setSwappedIds([a.playerId, b.playerId]);
                  dispatch({ type: 'UPDATE_MATCH_LINEUP', lineup: updatedLineup });
                  dispatch({ type: 'START_MATCH_SWAP_ANIM', playerAId: a.playerId, playerBId: b.playerId, startTime: performance.now() });
                } else if (data.source === 'bench') {
                  // Bench player dropped onto a starter — swap them
                  const benchPlayer = plan.startingBench.find(b => b.id === data.id);
                  if (!benchPlayer) return;
                  // The starter goes to bench
                  const newBenchPlayer: SubstitutePlayer = {
                    id: p.playerId,
                    team: 'A',
                    number: p.number,
                    name: p.name,
                  };
                  // The bench player becomes a starter with the dropped-on player's role
                  const newStarter: PlayerRoleAssignment = {
                    playerId: benchPlayer.id,
                    number: benchPlayer.number,
                    name: benchPlayer.name,
                    role: p.role,
                    isGK: p.isGK,
                  };
                  dispatch({
                    type: 'UPDATE_MATCH_LINEUP_AND_BENCH',
                    lineup: plan.startingLineup.map(lp =>
                      lp.playerId === p.playerId ? newStarter : lp,
                    ),
                    bench: plan.startingBench.map(b =>
                      b.id === data.id ? newBenchPlayer : b,
                    ),
                  });
                }
              } catch { /* ignore invalid drag data */ }
            }) : undefined}
          />
        ))}

        {/* Divider */}
        <div style={{ height: 1, background: theme.border, margin: '6px 12px' }} />

        {/* Bench */}
        <div
          style={{
            padding: '6px 12px 2px',
            fontSize: 13,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: theme.textSubtle,
          }}
          onDragOver={minute === 0 ? (e => { e.preventDefault(); e.currentTarget.style.background = hexToRgba(theme.highlight, 0.05); }) : undefined}
          onDragLeave={minute === 0 ? (e => { e.currentTarget.style.background = ''; }) : undefined}
          onDrop={minute === 0 ? (e => {
            e.preventDefault();
            e.currentTarget.style.background = '';
            try {
              const data = JSON.parse(e.dataTransfer.getData('text/plain'));
              if (data.source === 'starting') {
                // Move starter to bench
                const starter = plan.startingLineup.find(lp => lp.playerId === data.id);
                if (!starter) return;
                const newBenchPlayer: SubstitutePlayer = {
                  id: starter.playerId,
                  team: 'A',
                  number: starter.number,
                  name: starter.name,
                };
                dispatch({ type: 'UPDATE_MATCH_LINEUP_AND_BENCH', lineup: plan.startingLineup.filter(lp => lp.playerId !== data.id), bench: [...plan.startingBench, newBenchPlayer] });
              }
            } catch { /* ignore invalid drag data */ }
          }) : undefined}
        >
          Bench ({matchState.bench.length})
        </div>
        {minute === 0 ? (
          <>
            {matchState.bench.length === 0 && (
              <div style={{ padding: '8px 12px', fontSize: 12, color: theme.textSubtle, textAlign: 'center' }}>
                No bench players yet. Add substitutes below.
              </div>
            )}
            {matchState.bench.map(s => (
              <EditableBenchRow
                key={s.id}
                sub={s}
                teamColor={state.teamAColor}
                draggable
                onDragStart={e => {
                  e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'bench', id: s.id }));
                  e.dataTransfer.effectAllowed = 'move';
                  if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = '0.4';
                }}
                onEdit={(field, value) => {
                  const updated = plan.startingBench.map(b => {
                    if (b.id !== s.id) return b;
                    if (field === 'number') return { ...b, number: parseInt(value) || b.number };
                    return { ...b, name: value };
                  });
                  dispatch({ type: 'UPDATE_MATCH_BENCH', bench: updated });
                }}
                onRemove={() => {
                  dispatch({
                    type: 'UPDATE_MATCH_BENCH',
                    bench: plan.startingBench.filter(b => b.id !== s.id),
                  });
                }}
              />
            ))}
            <div style={{ padding: '4px 12px 6px' }}>
              <button
                onClick={() => {
                  const existingNums = [
                    ...plan.startingLineup.map(p => p.number),
                    ...plan.startingBench.map(b => b.number),
                  ];
                  let nextNum = 12;
                  while (existingNums.includes(nextNum)) nextNum++;
                  const newSub: SubstitutePlayer = {
                    id: `sub-a-${Date.now()}`,
                    team: 'A',
                    number: nextNum,
                    name: '',
                  };
                  dispatch({
                    type: 'UPDATE_MATCH_BENCH',
                    bench: [...plan.startingBench, newSub],
                  });
                }}
                style={{
                  width: '100%',
                  padding: '5px 0',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  border: `1px solid ${theme.borderSubtle}`,
                  borderRadius: 4,
                  background: 'transparent',
                  color: theme.textMuted,
                  cursor: 'pointer',
                }}
              >
                + Add Substitute
              </button>
            </div>
          </>
        ) : (
          <>
            {matchState.bench.length === 0 && (
              <div style={{ padding: '8px 12px', fontSize: 12, color: theme.textSubtle, textAlign: 'center' }}>
                No bench players. Go to 0&prime; to add substitutes.
              </div>
            )}
            {matchState.bench.map(s => {
              const played = matchState.minutesPlayed[s.id] ?? 0;
              const history = matchState.positionHistory[s.id] ?? [];
              return (
                <MatchPlayerRow
                  key={s.id}
                  number={s.number}
                  name={s.name}
                  role={history.length > 0 ? history[history.length - 1].role : 'CM'}
                  minutesPlayed={played}
                  totalMinutes={totalMinutes}
                  positionHistory={history}
                  isOnPitch={false}
                  teamColor={state.teamAColor}
                  subMinute={getSubMinute(s.id)}
                />
              );
            })}
          </>
        )}

        {/* Substitution events list */}
        {subEvents.length > 0 && (
          <>
            <div style={{ height: 1, background: theme.border, margin: '6px 12px' }} />
            <div style={{
              padding: '6px 12px 2px',
              fontSize: 13,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: theme.textSubtle,
            }}>
              Substitutions ({subEvents.length})
            </div>
            {subEvents.map(e => {
              const inName = findPlayerName(plan, e.playerInId);
              const outName = findPlayerName(plan, e.playerOutId);
              return (
                <div
                  key={e.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', fontSize: 12 }}
                >
                  <span style={{ color: theme.highlight, fontWeight: 600, width: 28, flexShrink: 0 }}>
                    {e.minute}&prime;
                  </span>
                  <span style={{ color: '#22c55e' }}>IN</span>
                  <span style={{ color: theme.secondary }}>
                    #{inName.number} {inName.name}
                  </span>
                  <span style={{ color: '#ef4444' }}>OUT</span>
                  <span style={{ color: theme.secondary }}>
                    #{outName.number} {outName.name}
                  </span>
                  <button
                    onClick={() => dispatch({ type: 'REMOVE_MATCH_EVENT', eventId: e.id })}
                    title="Remove substitution"
                    style={{
                      marginLeft: 'auto',
                      background: 'none',
                      border: 'none',
                      color: theme.textSubtle,
                      cursor: 'pointer',
                      fontSize: 14,
                      padding: '0 2px',
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </>
        )}

        {/* Position change events list */}
        {allPosChanges.length > 0 && (
          <>
            <div style={{ height: 1, background: theme.border, margin: '6px 12px' }} />
            <div style={{
              padding: '6px 12px 2px',
              fontSize: 13,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: theme.textSubtle,
            }}>
              Position Changes ({allPosChanges.length})
            </div>
            {allPosChanges.map(e => {
              const playerInfo = findPlayerName(plan, e.playerId);
              const fromLabel = ROLE_LABELS[e.fromRole as PositionRole] || e.fromRole;
              const toLabel = ROLE_LABELS[e.toRole as PositionRole] || e.toRole;
              const isImplicit = e.id.startsWith('implicit-sub-');
              return (
                <div
                  key={e.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', fontSize: 12 }}
                >
                  <span style={{ color: theme.highlight, fontWeight: 600, width: 28, flexShrink: 0 }}>
                    {e.minute}&prime;
                  </span>
                  <span style={{ color: theme.secondary }}>
                    #{playerInfo.number} {playerInfo.name}
                  </span>
                  <span style={{ color: '#3b82f6' }}>
                    {fromLabel} → {toLabel}
                  </span>
                  {isImplicit ? (
                    <span
                      title="Position changed via substitution"
                      style={{ marginLeft: 'auto', fontSize: 10, color: theme.textSubtle, fontStyle: 'italic' }}
                    >
                      via sub
                    </span>
                  ) : (
                    <button
                      onClick={() => dispatch({ type: 'REMOVE_MATCH_EVENT', eventId: e.id })}
                      title="Remove position change"
                      style={{
                        marginLeft: 'auto',
                        background: 'none',
                        border: 'none',
                        color: theme.textSubtle,
                        cursor: 'pointer',
                        fontSize: 14,
                        padding: '0 2px',
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Footer navigation */}
      <div style={{ padding: '8px 12px', borderTop: `1px solid ${theme.border}`, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button
          onClick={() => setShowBrowser(true)}
          style={{
            width: '100%',
            padding: '6px 0',
            fontSize: 12,
            fontFamily: 'inherit',
            border: `1px solid ${theme.borderSubtle}`,
            borderRadius: 4,
            background: 'transparent',
            color: theme.textMuted,
            cursor: 'pointer',
          }}
        >
          Load Match...
        </button>
        <button
          onClick={() => dispatch({ type: 'EXIT_MATCH_MANAGEMENT' })}
          style={{
            width: '100%',
            padding: '6px 0',
            fontSize: 12,
            fontFamily: 'inherit',
            border: `1px solid ${theme.borderSubtle}`,
            borderRadius: 4,
            background: 'transparent',
            color: theme.textMuted,
            cursor: 'pointer',
          }}
        >
          Exit Match Management
        </button>
      </div>

      {/* Dialogs */}
      {showExportDialog && createPortal(
        <MatchExportDialog onClose={() => setShowExportDialog(false)} />,
        document.body,
      )}
      {showBrowser && createPortal(
        <MatchPlansBrowser onClose={() => setShowBrowser(false)} />,
        document.body,
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  Main MatchDashboard (routing between screens)
// ═══════════════════════════════════════════

export function MatchDashboard() {
  const { state } = useAppState();

  // Show landing screen when no match is loaded
  if (!state.matchPlan) {
    return <LandingScreen />;
  }

  return <ActiveMatchUI />;
}

// ═══════════════════════════════════════════
//  Sub-components (unchanged from original)
// ═══════════════════════════════════════════

/** Match Setup: own team name + kit, opponent name + kit */
function MatchSetupSection({
  plan,
  teamAName,
  teamBName,
  onOpponentChange,
  onOwnKitChange,
}: {
  plan: MatchPlan;
  teamAName: string;
  teamBName: string;
  onOpponentChange: (opponent: MatchOpponent) => void;
  onOwnKitChange: (kit: MatchOwnKit) => void;
}) {
  const theme = useThemeColors();
  const opponent = plan.opponent ?? { name: '', color: '#ef4444', outlineColor: '#000000', secondaryColor: null };
  const ownKit = plan.ownKit ?? { name: '', color: '#3b82f6', outlineColor: '#000000', secondaryColor: null };

  const smallLabelStyle = { fontSize: 12, color: theme.textSubtle, marginBottom: 2, display: 'block' as const };
  const inputStyle = {
    width: '100%',
    padding: '3px 6px',
    fontSize: 12,
    fontFamily: 'inherit',
    background: hexToRgba(theme.secondary, 0.05),
    border: `1px solid ${theme.borderSubtle}`,
    borderRadius: 3,
    color: theme.secondary,
    outline: 'none',
    boxSizing: 'border-box' as const,
  };
  const colorSwatchStyle = {
    width: 22, height: 18, padding: 0,
    border: `1px solid ${theme.borderSubtle}`, borderRadius: 3,
    cursor: 'pointer', background: 'transparent',
  };

  return (
    <div style={{ padding: '4px 12px 8px' }}>
      <span style={smallLabelStyle}>Own Team</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
        <input type="text" value={ownKit.name || teamAName} onChange={e => onOwnKitChange({ ...ownKit, name: e.target.value })} placeholder="Team name" style={{ ...inputStyle, flex: 1 }} />
        <input type="color" value={ownKit.color} onChange={e => onOwnKitChange({ ...ownKit, color: e.target.value })} title="Kit color" style={colorSwatchStyle} />
        <input type="color" value={ownKit.outlineColor} onChange={e => onOwnKitChange({ ...ownKit, outlineColor: e.target.value })} title="Kit outline" style={colorSwatchStyle} />
      </div>
      <span style={smallLabelStyle}>Opponent</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input type="text" value={opponent.name || teamBName} onChange={e => onOpponentChange({ ...opponent, name: e.target.value })} placeholder="Opponent name" style={{ ...inputStyle, flex: 1 }} />
        <input type="color" value={opponent.color} onChange={e => onOpponentChange({ ...opponent, color: e.target.value })} title="Opponent kit color" style={colorSwatchStyle} />
        <input type="color" value={opponent.outlineColor} onChange={e => onOpponentChange({ ...opponent, outlineColor: e.target.value })} title="Opponent kit outline" style={colorSwatchStyle} />
      </div>
    </div>
  );
}

/** Inline-editable bench player row for minute 0 */
function EditableBenchRow({
  sub,
  teamColor,
  draggable: isDraggable,
  onDragStart,
  onEdit,
  onRemove,
}: {
  sub: SubstitutePlayer;
  teamColor: string;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onEdit: (field: 'number' | 'name', value: string) => void;
  onRemove: () => void;
}) {
  const theme = useThemeColors();
  const [editing, setEditing] = useState<'number' | 'name' | null>(null);

  return (
    <div
      draggable={isDraggable && !editing}
      onDragStart={onDragStart}
      onDragEnd={e => { if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = '1'; }}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: isDraggable ? '6px 10px' : '5px 12px',
        margin: isDraggable ? '3px 8px' : undefined,
        cursor: isDraggable && !editing ? 'grab' : undefined,
        background: isDraggable ? hexToRgba(teamColor, 0.04) : undefined,
        border: isDraggable ? `1px solid ${theme.borderSubtle}` : undefined,
        borderRadius: isDraggable ? 6 : undefined,
      }}
    >
      {/* Drag handle */}
      {isDraggable && (
        <span style={{ fontSize: 10, color: theme.textSubtle, cursor: 'grab', userSelect: 'none', flexShrink: 0, width: 8, opacity: 0.5 }}>
          ⠿
        </span>
      )}
      {/* Number badge */}
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        background: hexToRgba(teamColor, 0.4),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0,
      }}>
        {editing === 'number' ? (
          <input
            type="text" autoFocus defaultValue={sub.number.toString()}
            onBlur={e => { onEdit('number', e.target.value); setEditing(null); }}
            onKeyDown={e => { if (e.key === 'Enter') { onEdit('number', (e.target as HTMLInputElement).value); setEditing(null); } }}
            style={{ width: 20, background: 'transparent', border: 'none', color: '#ffffff', fontSize: 10, fontWeight: 700, textAlign: 'center', outline: 'none' }}
          />
        ) : (
          <span onClick={() => setEditing('number')} style={{ cursor: 'pointer' }}>{sub.number}</span>
        )}
      </div>

      {/* Name */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing === 'name' ? (
          <input
            type="text" autoFocus defaultValue={sub.name} placeholder="Name"
            onBlur={e => { onEdit('name', e.target.value); setEditing(null); }}
            onKeyDown={e => { if (e.key === 'Enter') { onEdit('name', (e.target as HTMLInputElement).value); setEditing(null); } }}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.05)',
              border: `1px solid ${theme.borderSubtle}`, borderRadius: 3,
              color: theme.secondary, fontSize: 12, padding: '1px 4px', outline: 'none', fontFamily: 'inherit',
            }}
          />
        ) : (
          <span
            onClick={() => setEditing('name')}
            style={{
              fontSize: 12, color: sub.name ? theme.secondary : theme.textSubtle,
              cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
            }}
          >
            {sub.name || 'Click to name'}
          </span>
        )}
      </div>

      {/* Remove button */}
      <button
        onClick={onRemove} title="Remove substitute"
        style={{ background: 'none', border: 'none', color: theme.textSubtle, cursor: 'pointer', fontSize: 14, padding: '0 2px', lineHeight: 1, flexShrink: 0 }}
      >
        ×
      </button>
    </div>
  );
}

/**
 * Detect implicit position changes from substitutions where a player returns
 * to the pitch in a different role than they previously played.
 */
function getImplicitPosChangesFromSubs(
  plan: MatchPlan,
  subEvents: MatchSubstitutionEvent[],
): MatchPositionChangeEvent[] {
  const totalMinutes = getTotalMinutes(plan);
  const finalState = computeMatchStateAtMinute(plan, totalMinutes);
  const result: MatchPositionChangeEvent[] = [];

  for (const sub of subEvents) {
    const history = finalState.positionHistory[sub.playerInId];
    if (!history || history.length < 2) continue;

    const returnEntry = history.find(h => h.from === sub.minute);
    if (!returnEntry) continue;

    const prevEntries = history.filter(h => h.to <= sub.minute);
    if (prevEntries.length === 0) continue;
    const prevEntry = prevEntries[prevEntries.length - 1];

    if (prevEntry.role !== returnEntry.role) {
      result.push({
        type: 'position-change',
        id: `implicit-sub-${sub.id}`,
        minute: sub.minute,
        playerId: sub.playerInId,
        fromRole: prevEntry.role,
        toRole: returnEntry.role,
      });
    }
  }

  return result;
}

/** Helper to find a player's name/number across lineup and bench */
function findPlayerName(
  plan: { startingLineup: Array<{ playerId: string; number: number; name: string }>; startingBench: Array<{ id: string; number: number; name: string }> },
  playerId: string,
): { number: number; name: string } {
  const fromLineup = plan.startingLineup.find(p => p.playerId === playerId);
  if (fromLineup) return { number: fromLineup.number, name: fromLineup.name };
  const fromBench = plan.startingBench.find(s => s.id === playerId);
  if (fromBench) return { number: fromBench.number, name: fromBench.name };
  return { number: 0, name: '?' };
}
