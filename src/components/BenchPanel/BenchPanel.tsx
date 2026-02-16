import { useState } from 'react';
import { useAppState } from '../../state/AppStateContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import { hexToRgba } from '../../utils/colorUtils';
import type { SubstitutePlayer } from '../../types';

export function BenchPanel() {
  const { state, dispatch } = useAppState();
  const theme = useThemeColors();
  const [pendingSubId, setPendingSubId] = useState<string | null>(null);

  if (!state.activeBench) return null;

  const team = state.activeBench;
  const teamName = team === 'A' ? state.teamAName : state.teamBName;
  const teamColor = team === 'A' ? state.teamAColor : state.teamBColor;
  const substitutes = team === 'A' ? state.substitutesA : state.substitutesB;

  const handleAddSub = () => {
    const existingNums = [
      ...state.players.filter(p => p.team === team).map(p => p.number),
      ...substitutes.map(s => s.number),
    ];
    let nextNum = 12;
    while (existingNums.includes(nextNum)) nextNum++;

    const sub: SubstitutePlayer = {
      id: `sub-${team.toLowerCase()}-${Date.now()}`,
      team,
      number: nextNum,
      name: '',
    };
    dispatch({ type: 'ADD_SUBSTITUTE', team, substitute: sub });
  };

  const handleRemoveSub = (subId: string) => {
    dispatch({ type: 'REMOVE_SUBSTITUTE', team, substituteId: subId });
    if (pendingSubId === subId) setPendingSubId(null);
  };

  const handleSubIn = (subId: string) => {
    if (pendingSubId === subId) {
      setPendingSubId(null); // Cancel substitution mode
    } else {
      setPendingSubId(subId);
    }
  };

  const handlePlayerClick = (playerId: string) => {
    if (!pendingSubId) return;
    dispatch({
      type: 'SUBSTITUTE_PLAYER',
      team,
      substituteId: pendingSubId,
      playerId,
    });
    setPendingSubId(null);
  };

  // When in substitution mode, show which on-pitch players can be swapped
  const onPitchPlayers = state.players.filter(p => p.team === team);

  return (
    <div
      style={{
        position: 'absolute',
        [team === 'A' ? 'left' : 'right']: 8,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 220,
        background: '#111827',
        border: `1px solid ${teamColor}40`,
        borderRadius: 8,
        boxShadow: `0 4px 24px rgba(0, 0, 0, 0.5), 0 0 0 1px ${teamColor}20`,
        zIndex: 10,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: teamColor,
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
            {teamName} — Bench
          </span>
        </div>
        <button
          onClick={() => dispatch({ type: 'SET_ACTIVE_BENCH', bench: null })}
          style={{
            background: 'none',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            fontSize: 16,
            padding: '0 4px',
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* Substitutes list */}
      <div style={{ padding: '8px 0', maxHeight: 300, overflowY: 'auto' }}>
        {substitutes.length === 0 && (
          <div
            style={{
              padding: '12px 16px',
              fontSize: 11,
              color: '#64748b',
              textAlign: 'center',
            }}
          >
            No substitutes yet
          </div>
        )}
        {substitutes.map(sub => (
          <SubstituteRow
            key={sub.id}
            sub={sub}
            team={team}
            teamColor={teamColor}
            isPending={pendingSubId === sub.id}
            onSubIn={() => handleSubIn(sub.id)}
            onRemove={() => handleRemoveSub(sub.id)}
            onEdit={(field, value) => {
              if (field === 'number') {
                dispatch({
                  type: 'EDIT_SUBSTITUTE',
                  team,
                  substituteId: sub.id,
                  number: parseInt(value) || sub.number,
                });
              } else {
                dispatch({
                  type: 'EDIT_SUBSTITUTE',
                  team,
                  substituteId: sub.id,
                  name: value,
                });
              }
            }}
          />
        ))}
      </div>

      {/* Substitution mode: pick player to swap */}
      {pendingSubId && (
        <div
          style={{
            padding: '8px 12px',
            borderTop: '1px solid #1e293b',
            background: hexToRgba(theme.accent, 0.08),
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: theme.accent,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 6,
            }}
          >
            Select player to replace:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {onPitchPlayers.map(p => (
              <button
                key={p.id}
                onClick={() => handlePlayerClick(p.id)}
                style={{
                  padding: '3px 8px',
                  fontSize: 11,
                  fontFamily: 'inherit',
                  border: `1px solid ${teamColor}60`,
                  borderRadius: 4,
                  background: `${teamColor}15`,
                  color: '#e2e8f0',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = `${teamColor}30`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = `${teamColor}15`;
                }}
              >
                #{p.number} {p.name || ''}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add substitute button */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid #1e293b' }}>
        <button
          onClick={handleAddSub}
          style={{
            width: '100%',
            padding: '6px 0',
            fontSize: 11,
            fontFamily: 'inherit',
            border: '1px solid #374151',
            borderRadius: 4,
            background: 'transparent',
            color: '#94a3b8',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = theme.accent;
            e.currentTarget.style.color = theme.accent;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = '#374151';
            e.currentTarget.style.color = '#94a3b8';
          }}
        >
          + Add Substitute
        </button>
      </div>
    </div>
  );
}

function SubstituteRow({
  sub,
  team,
  teamColor,
  isPending,
  onSubIn,
  onRemove,
  onEdit,
}: {
  sub: SubstitutePlayer;
  team: 'A' | 'B';
  teamColor: string;
  isPending: boolean;
  onSubIn: () => void;
  onRemove: () => void;
  onEdit: (field: 'number' | 'name', value: string) => void;
}) {
  const theme = useThemeColors();
  const [editing, setEditing] = useState<'number' | 'name' | null>(null);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 12px',
        background: isPending ? hexToRgba(theme.accent, 0.1) : 'transparent',
        borderLeft: isPending ? `2px solid ${theme.accent}` : '2px solid transparent',
      }}
    >
      {/* Token */}
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: teamColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          fontWeight: 700,
          color: '#ffffff',
          flexShrink: 0,
          opacity: 0.8,
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
              border: '1px solid #374151',
              borderRadius: 3,
              color: '#e2e8f0',
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
              color: sub.name ? '#e2e8f0' : '#4b5563',
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

      {/* Sub In button */}
      <button
        onClick={onSubIn}
        title={isPending ? 'Cancel substitution' : 'Substitute in'}
        style={{
          padding: '2px 6px',
          fontSize: 9,
          fontFamily: 'inherit',
          border: isPending ? `1px solid ${theme.accent}` : '1px solid #374151',
          borderRadius: 3,
          background: isPending ? hexToRgba(theme.accent, 0.2) : 'transparent',
          color: isPending ? theme.accent : '#64748b',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {isPending ? 'Cancel' : 'Sub'}
      </button>

      {/* Remove button */}
      <button
        onClick={onRemove}
        title="Remove substitute"
        style={{
          background: 'none',
          border: 'none',
          color: '#4b5563',
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
