import { useState } from 'react';
import { useAppState } from '../../state/AppStateContext';
import { FORMATIONS } from '../../constants/formations';
import { FormationCard } from './FormationCard';
import type { Formation } from '../../types';

interface FormationGroup {
  label: string;
  formations: Formation[];
}

function groupFormations(): FormationGroup[] {
  const back4: Formation[] = [];
  const back3: Formation[] = [];
  const back5: Formation[] = [];

  for (const f of FORMATIONS) {
    if (f.id.startsWith('5-')) {
      back5.push(f);
    } else if (f.id.startsWith('3-')) {
      back3.push(f);
    } else {
      back4.push(f);
    }
  }

  const groups: FormationGroup[] = [];
  if (back4.length > 0) groups.push({ label: 'Back 4', formations: back4 });
  if (back3.length > 0) groups.push({ label: 'Back 3', formations: back3 });
  if (back5.length > 0) groups.push({ label: 'Back 5', formations: back5 });
  return groups;
}

const FORMATION_GROUPS = groupFormations();

export function FormationPanel() {
  const { state, dispatch } = useAppState();
  const activeFormation =
    state.activeTeam === 'A' ? state.teamAFormation : state.teamBFormation;

  // All groups start expanded
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleGroup = (label: string) => {
    setCollapsed(prev => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        height: '100%',
      }}
    >
      {/* Team selector + header */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          justifyContent: 'stretch',
        }}
      >
        <TeamToggle
          team="A"
          label={state.teamAName}
          color={state.teamAColor}
          active={state.activeTeam === 'A'}
          onClick={() => dispatch({ type: 'SET_ACTIVE_TEAM', team: 'A' })}
        />
        <TeamToggle
          team="B"
          label={state.teamBName}
          color={state.teamBColor}
          active={state.activeTeam === 'B'}
          onClick={() => dispatch({ type: 'SET_ACTIVE_TEAM', team: 'B' })}
        />
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 6px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {FORMATION_GROUPS.map(group => {
          const isCollapsed = !!collapsed[group.label];
          const hasActive = group.formations.some(f => f.id === activeFormation);

          return (
            <div key={group.label}>
              {/* Group header */}
              <button
                onClick={() => toggleGroup(group.label)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  width: '100%',
                  padding: '6px 6px',
                  border: 'none',
                  borderRadius: 4,
                  background: 'transparent',
                  color: hasActive ? '#e2e8f0' : '#94a3b8',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#e2e8f0'; }}
                onMouseLeave={e => { if (!hasActive) e.currentTarget.style.color = '#94a3b8'; }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 12,
                    textAlign: 'center',
                    fontSize: 9,
                    transition: 'transform 0.15s',
                    transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                  }}
                >
                  ▾
                </span>
                {group.label}
                <span style={{ fontSize: 10, fontWeight: 400, color: '#64748b', marginLeft: 'auto' }}>
                  {group.formations.length}
                </span>
              </button>

              {/* Formation grid */}
              {!isCollapsed && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 2,
                    padding: '2px 0 6px',
                  }}
                >
                  {group.formations.map(f => (
                    <FormationCard
                      key={f.id}
                      formation={f}
                      active={f.id === activeFormation}
                      onClick={() =>
                        dispatch({
                          type: 'APPLY_FORMATION',
                          team: state.activeTeam,
                          formationId: f.id,
                        })
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TeamToggle({
  label,
  color,
  active,
  onClick,
}: {
  team: 'A' | 'B';
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 8px',
        fontSize: 11,
        fontFamily: 'inherit',
        fontWeight: active ? 600 : 400,
        border: active ? `1px solid ${color}` : '1px solid #334155',
        borderRadius: 4,
        background: active ? `${color}22` : 'transparent',
        color: active ? '#e2e8f0' : '#64748b',
        cursor: 'pointer',
        outline: 'none',
        transition: 'all 0.15s',
        flex: 1,
        minWidth: 0,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }}
      />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </button>
  );
}
