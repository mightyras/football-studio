import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppState } from '../../state/AppStateContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import { hexToRgba } from '../../utils/colorUtils';
import { computeMatchStateAtMinute, getTotalMinutes } from '../../utils/matchComputation';
import { MatchPlayerRow } from './MatchPlayerRow';
import { MatchRuleConfig } from './MatchRuleConfig';
import { MatchExportDialog } from './MatchExportDialog';
import type { MatchSubstitutionEvent, MatchPositionChangeEvent } from '../../types/matchManagement';
import type { SubstitutePlayer, PositionRole } from '../../types';
import { ROLE_LABELS } from '../../types';

export function MatchDashboard() {
  const { state, dispatch } = useAppState();
  const theme = useThemeColors();
  const [showConfig, setShowConfig] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);

  const plan = state.matchPlan;
  const minute = state.matchCurrentMinute;
  const totalMinutes = plan ? getTotalMinutes(plan) : 0;

  const matchState = useMemo(
    () => plan ? computeMatchStateAtMinute(plan, minute) : null,
    [plan, minute],
  );

  if (!plan || !matchState) {
    return (
      <div style={{ padding: 16, fontSize: 12, color: theme.textSubtle, textAlign: 'center' }}>
        Enter Match Management mode to begin planning.
      </div>
    );
  }

  // Find sub events and position change events
  const subEvents = plan.events.filter(
    (e): e is MatchSubstitutionEvent => e.type === 'substitution',
  );
  const posChangeEvents = plan.events.filter(
    (e): e is MatchPositionChangeEvent => {
      if (e.type !== 'position-change') return false;
      // Hide position changes that are redundant because the player was subbed in
      // at the same minute (the sub's assignedRole or the merge logic handles it)
      const subbedInAtSameMinute = subEvents.some(
        s => s.playerInId === e.playerId && s.minute === e.minute,
      );
      return !subbedInAtSameMinute;
    },
  );

  const allPosChanges = useMemo(
    () => [...posChangeEvents].sort((a, b) => a.minute - b.minute),
    [posChangeEvents],
  );

  const getSubMinute = (playerId: string): number | undefined => {
    // Was this player subbed in?
    const subIn = subEvents.find(e => e.playerInId === playerId);
    if (subIn) return subIn.minute;
    // Was this player subbed out?
    const subOut = subEvents.find(e => e.playerOutId === playerId);
    if (subOut) return subOut.minute;
    return undefined;
  };

  const isStarter = (playerId: string) =>
    plan.startingLineup.some(p => p.playerId === playerId);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 12px',
          borderBottom: `1px solid ${theme.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: theme.secondary,
          }}
        >
          Match Management
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setShowExportDialog(true)}
            style={{
              fontSize: 9,
              fontFamily: 'inherit',
              padding: '2px 8px',
              border: `1px solid ${theme.borderSubtle}`,
              borderRadius: 3,
              background: 'transparent',
              color: theme.textMuted,
              cursor: 'pointer',
            }}
          >
            Export
          </button>
          <button
            onClick={() => setShowConfig(p => !p)}
            style={{
              fontSize: 9,
              fontFamily: 'inherit',
              padding: '2px 8px',
              border: `1px solid ${theme.borderSubtle}`,
              borderRadius: 3,
              background: showConfig ? hexToRgba(theme.highlight, 0.1) : 'transparent',
              color: showConfig ? theme.highlight : theme.textMuted,
              cursor: 'pointer',
            }}
          >
            {showConfig ? 'Hide Config' : 'Config'}
          </button>
        </div>
      </div>

      {/* Config section */}
      {showConfig && (
        <div style={{ borderBottom: `1px solid ${theme.border}`, flexShrink: 0 }}>
          <MatchRuleConfig />
        </div>
      )}

      {/* Summary bar */}
      <div
        style={{
          padding: '6px 12px',
          display: 'flex',
          gap: 12,
          fontSize: 10,
          borderBottom: `1px solid ${theme.border}`,
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
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
            fontSize: 9,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: theme.textSubtle,
          }}
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
          />
        ))}

        {/* Divider */}
        <div style={{ height: 1, background: theme.border, margin: '6px 12px' }} />

        {/* Bench */}
        <div
          style={{
            padding: '6px 12px 2px',
            fontSize: 9,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: theme.textSubtle,
          }}
        >
          Bench ({matchState.bench.length})
        </div>
        {minute === 0 ? (
          <>
            {/* Editable bench at kickoff */}
            {matchState.bench.length === 0 && (
              <div
                style={{
                  padding: '8px 12px',
                  fontSize: 10,
                  color: theme.textSubtle,
                  textAlign: 'center',
                }}
              >
                No bench players yet. Add substitutes below.
              </div>
            )}
            {matchState.bench.map(s => (
              <EditableBenchRow
                key={s.id}
                sub={s}
                teamColor={state.teamAColor}
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
                  fontSize: 10,
                  fontFamily: 'inherit',
                  border: `1px solid ${theme.borderSubtle}`,
                  borderRadius: 4,
                  background: 'transparent',
                  color: theme.textMuted,
                  cursor: 'pointer',
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
                + Add Substitute
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Read-only bench at other minutes */}
            {matchState.bench.length === 0 && (
              <div
                style={{
                  padding: '8px 12px',
                  fontSize: 10,
                  color: theme.textSubtle,
                  textAlign: 'center',
                }}
              >
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
            <div
              style={{
                padding: '6px 12px 2px',
                fontSize: 9,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: theme.textSubtle,
              }}
            >
              Substitutions ({subEvents.length})
            </div>
            {subEvents.map(e => {
              const inName = findPlayerName(plan, e.playerInId);
              const outName = findPlayerName(plan, e.playerOutId);

              return (
                <div
                  key={e.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 12px',
                    fontSize: 10,
                  }}
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
                      fontSize: 12,
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
            <div
              style={{
                padding: '6px 12px 2px',
                fontSize: 9,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: theme.textSubtle,
              }}
            >
              Position Changes ({allPosChanges.length})
            </div>
            {allPosChanges.map(e => {
              const playerInfo = findPlayerName(plan, e.playerId);
              const fromLabel = ROLE_LABELS[e.fromRole as PositionRole] || e.fromRole;
              const toLabel = ROLE_LABELS[e.toRole as PositionRole] || e.toRole;
              return (
                <div
                  key={e.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 12px',
                    fontSize: 10,
                  }}
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
                  <button
                    onClick={() => dispatch({ type: 'REMOVE_MATCH_EVENT', eventId: e.id })}
                    title="Remove position change"
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
            })}
          </>
        )}
      </div>

      {/* Exit button */}
      <div
        style={{
          padding: '8px 12px',
          borderTop: `1px solid ${theme.border}`,
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => dispatch({ type: 'EXIT_MATCH_MANAGEMENT' })}
          style={{
            width: '100%',
            padding: '6px 0',
            fontSize: 11,
            fontFamily: 'inherit',
            border: `1px solid ${theme.borderSubtle}`,
            borderRadius: 4,
            background: 'transparent',
            color: theme.textMuted,
            cursor: 'pointer',
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
          Exit Match Management
        </button>
      </div>

      {/* Export dialog rendered via portal to avoid stacking context issues */}
      {showExportDialog && createPortal(
        <MatchExportDialog onClose={() => setShowExportDialog(false)} />,
        document.body,
      )}
    </div>
  );
}

/** Inline-editable bench player row for minute 0 */
function EditableBenchRow({
  sub,
  teamColor,
  onEdit,
  onRemove,
}: {
  sub: SubstitutePlayer;
  teamColor: string;
  onEdit: (field: 'number' | 'name', value: string) => void;
  onRemove: () => void;
}) {
  const theme = useThemeColors();
  const [editing, setEditing] = useState<'number' | 'name' | null>(null);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 12px',
      }}
    >
      {/* Number badge */}
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: hexToRgba(teamColor, 0.4),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          fontWeight: 700,
          color: '#fff',
          flexShrink: 0,
        }}
      >
        {editing === 'number' ? (
          <input
            type="text"
            autoFocus
            defaultValue={sub.number.toString()}
            onBlur={e => {
              onEdit('number', e.target.value);
              setEditing(null);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                onEdit('number', (e.target as HTMLInputElement).value);
                setEditing(null);
              }
            }}
            style={{
              width: 20,
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              fontSize: 10,
              fontWeight: 700,
              textAlign: 'center',
              outline: 'none',
            }}
          />
        ) : (
          <span
            onClick={() => setEditing('number')}
            style={{ cursor: 'pointer' }}
          >
            {sub.number}
          </span>
        )}
      </div>

      {/* Name */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing === 'name' ? (
          <input
            type="text"
            autoFocus
            defaultValue={sub.name}
            placeholder="Name"
            onBlur={e => {
              onEdit('name', e.target.value);
              setEditing(null);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                onEdit('name', (e.target as HTMLInputElement).value);
                setEditing(null);
              }
            }}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.05)',
              border: `1px solid ${theme.borderSubtle}`,
              borderRadius: 3,
              color: theme.secondary,
              fontSize: 11,
              padding: '1px 4px',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
        ) : (
          <span
            onClick={() => setEditing('name')}
            style={{
              fontSize: 11,
              color: sub.name ? theme.secondary : theme.textSubtle,
              cursor: 'pointer',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'block',
            }}
          >
            {sub.name || 'Click to name'}
          </span>
        )}
      </div>

      {/* Remove button */}
      <button
        onClick={onRemove}
        title="Remove substitute"
        style={{
          background: 'none',
          border: 'none',
          color: theme.textSubtle,
          cursor: 'pointer',
          fontSize: 14,
          padding: '0 2px',
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
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
