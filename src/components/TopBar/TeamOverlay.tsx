import { useState, useRef, useEffect } from 'react';
import { useAppState } from '../../state/AppStateContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useTeam } from '../../state/TeamContext';
import { ColorSwatchPicker } from '../SettingsPanel/ColorSwatchPicker';
import { FormationCard } from '../FormationPanel/FormationCard';
import { FORMATIONS } from '../../constants/formations';
import type { Formation } from '../../types';

// ── Formation grouping ──

interface FormationGroup {
  label: string;
  formations: Formation[];
}

function groupFormations(): FormationGroup[] {
  const back4: Formation[] = [];
  const back3: Formation[] = [];
  const back5: Formation[] = [];

  for (const f of FORMATIONS) {
    if (f.id.startsWith('5-')) back5.push(f);
    else if (f.id.startsWith('3-')) back3.push(f);
    else back4.push(f);
  }

  const groups: FormationGroup[] = [];
  if (back4.length > 0) groups.push({ label: 'Back 4', formations: back4 });
  if (back3.length > 0) groups.push({ label: 'Back 3', formations: back3 });
  if (back5.length > 0) groups.push({ label: 'Back 5', formations: back5 });
  return groups;
}

const FORMATION_GROUPS = groupFormations();

// ── Hex-only color input (for My Team) ──

function HexColorInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const theme = useThemeColors();
  const [hex, setHex] = useState(value);

  useEffect(() => {
    setHex(value);
  }, [value]);

  function commit() {
    const trimmed = hex.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
      onChange(trimmed);
    } else {
      setHex(value);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: 4,
          background: value,
          border: `1px solid ${theme.borderSubtle}`,
          flexShrink: 0,
        }}
      />
      <input
        type="text"
        value={hex}
        onChange={e => setHex(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit();
        }}
        placeholder="#hexcolor"
        maxLength={7}
        style={{
          fontSize: 11,
          color: theme.secondary,
          background: theme.inputBg,
          border: `1px solid ${theme.borderSubtle}`,
          borderRadius: 4,
          padding: '4px 8px',
          fontFamily: 'monospace',
          width: 80,
          outline: 'none',
        }}
      />
    </div>
  );
}

// ── TeamOverlay (name, colors, show-names) ──

interface TeamOverlayProps {
  team: 'A' | 'B';
  onClose: () => void;
}

export function TeamOverlay({ team, onClose }: TeamOverlayProps) {
  const { state, dispatch } = useAppState();
  const theme = useThemeColors();
  const containerRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const isMyTeam = team === 'A';
  const name = isMyTeam ? state.teamAName : state.teamBName;
  const color = isMyTeam ? state.teamAColor : state.teamBColor;
  const outlineColor = isMyTeam ? state.teamAOutlineColor : state.teamBOutlineColor;
  const showNames = isMyTeam ? state.showPlayerNamesA : state.showPlayerNamesB;

  const [nameValue, setNameValue] = useState(name);

  useEffect(() => {
    setNameValue(name);
  }, [name]);

  // Auto-focus name input for opposition only
  useEffect(() => {
    if (!isMyTeam && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  function commitName() {
    const trimmed = nameValue.trim();
    if (!trimmed) {
      const fallback = team === 'A' ? 'My Team' : 'Opposition';
      dispatch({ type: 'RENAME_TEAM', team, name: fallback });
      setNameValue(fallback);
    } else if (trimmed !== name) {
      dispatch({ type: 'RENAME_TEAM', team, name: trimmed });
    } else {
      setNameValue(name);
    }
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: theme.textMuted,
    marginBottom: 4,
    display: 'block',
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: '100%',
        [isMyTeam ? 'left' : 'right']: 0,
        marginTop: 6,
        width: 280,
        maxHeight: 'calc(100vh - 80px)',
        overflowY: 'auto',
        background: theme.surface,
        border: `1px solid ${theme.borderSubtle}`,
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        zIndex: 1000,
        padding: 12,
      }}
      onPointerDown={e => e.stopPropagation()}
      onKeyDown={e => e.stopPropagation()}
    >
      {/* Team Name — static for My Team, editable for Opposition */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: color,
              border: `2px solid ${outlineColor}`,
              flexShrink: 0,
            }}
          />
          {isMyTeam ? (
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: theme.secondary,
                padding: '4px 0',
              }}
            >
              {name}
            </span>
          ) : (
            <input
              ref={nameInputRef}
              value={nameValue}
              onChange={e => setNameValue(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  commitName();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              maxLength={20}
              style={{
                flex: 1,
                fontSize: 14,
                fontWeight: 600,
                color: theme.secondary,
                background: theme.inputBg,
                border: `1px solid ${theme.borderSubtle}`,
                borderRadius: 4,
                padding: '4px 8px',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
          )}
        </div>
      </div>

      {/* Fill Color */}
      <div style={{ marginBottom: 10 }}>
        <span style={labelStyle}>Fill Color</span>
        {isMyTeam ? (
          <HexColorInput
            value={color}
            onChange={c => dispatch({ type: 'SET_TEAM_COLOR', team, color: c })}
          />
        ) : (
          <ColorSwatchPicker
            value={color}
            onChange={c => dispatch({ type: 'SET_TEAM_COLOR', team, color: c })}
          />
        )}
      </div>

      {/* Outline Color */}
      <div style={{ marginBottom: 10 }}>
        <span style={labelStyle}>Outline Color</span>
        {isMyTeam ? (
          <HexColorInput
            value={outlineColor}
            onChange={c => dispatch({ type: 'SET_TEAM_OUTLINE_COLOR', team, color: c })}
          />
        ) : (
          <ColorSwatchPicker
            value={outlineColor}
            onChange={c => dispatch({ type: 'SET_TEAM_OUTLINE_COLOR', team, color: c })}
          />
        )}
      </div>

      {/* Toggle switches */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            fontSize: 12,
            color: theme.secondary,
          }}
        >
          <input
            type="checkbox"
            checked={showNames}
            onChange={e =>
              dispatch({ type: 'SET_SHOW_PLAYER_NAMES', team, show: e.target.checked })
            }
            style={{
              accentColor: theme.highlight,
              width: 14,
              height: 14,
              cursor: 'pointer',
            }}
          />
          Show Player Names
        </label>

        {/* Show Logo on Markers — only for My Team when a logo exists */}
        {isMyTeam && (state.teamALogoUrl || state.clubIdentity.logoDataUrl) && (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              fontSize: 12,
              color: theme.secondary,
            }}
          >
            <input
              type="checkbox"
              checked={state.showLogoOnMarkers}
              onChange={e =>
                dispatch({ type: 'SET_SHOW_LOGO_ON_MARKERS', show: e.target.checked })
              }
              style={{
                accentColor: theme.highlight,
                width: 14,
                height: 14,
                cursor: 'pointer',
              }}
            />
            Show Logo on Markers
          </label>
        )}
      </div>
    </div>
  );
}

// ── FormationDropdown (separate overlay for formation selection) ──

interface FormationDropdownProps {
  team: 'A' | 'B';
  onClose: () => void;
}

export function FormationDropdown({ team, onClose }: FormationDropdownProps) {
  const { state, dispatch } = useAppState();
  const theme = useThemeColors();
  const { activeTeam, isSuperAdmin, updateDefaultFormation } = useTeam();
  const containerRef = useRef<HTMLDivElement>(null);

  const isMyTeam = team === 'A';
  const activeFormation = isMyTeam ? state.teamAFormation : state.teamBFormation;
  const isAdmin = isMyTeam && activeTeam && (activeTeam.myRole === 'admin' || isSuperAdmin);
  const defaultFormationId = activeTeam?.default_formation_id ?? '4-4-2';
  const isDefault = activeFormation === defaultFormationId;

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const toggleGroup = (label: string) => {
    setCollapsed(prev => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        marginTop: 6,
        width: 300,
        maxHeight: 'calc(100vh - 80px)',
        overflowY: 'auto',
        background: theme.surface,
        border: `1px solid ${theme.borderSubtle}`,
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        zIndex: 1000,
        padding: 10,
      }}
      onPointerDown={e => e.stopPropagation()}
      onKeyDown={e => e.stopPropagation()}
    >
      {/* Default formation indicator — Team A only */}
      {isMyTeam && activeTeam && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 4px 8px',
            borderBottom: `1px solid ${theme.borderSubtle}`,
            marginBottom: 6,
          }}
        >
          {isDefault ? (
            <span style={{ fontSize: 11, color: theme.highlight, fontWeight: 500 }}>
              ★ Default formation
            </span>
          ) : (
            <>
              <span style={{ fontSize: 11, color: theme.textMuted }}>
                Default: {getFormationName(defaultFormationId)}
              </span>
              {isAdmin && (
                <button
                  onClick={async () => {
                    if (activeFormation) await updateDefaultFormation(activeFormation);
                  }}
                  style={{
                    fontSize: 11,
                    color: theme.highlight,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontWeight: 500,
                    padding: '2px 6px',
                    borderRadius: 4,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = theme.surfaceHover;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                  title="Set current formation as team default"
                >
                  Set as default
                </button>
              )}
            </>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {FORMATION_GROUPS.map(group => {
          const isCollapsed = !!collapsed[group.label];
          const hasActive = group.formations.some(f => f.id === activeFormation);

          return (
            <div key={group.label}>
              <button
                onClick={() => toggleGroup(group.label)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  width: '100%',
                  padding: '5px 4px',
                  border: 'none',
                  borderRadius: 4,
                  background: 'transparent',
                  color: hasActive ? theme.secondary : theme.textMuted,
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = theme.secondary;
                }}
                onMouseLeave={e => {
                  if (!hasActive) e.currentTarget.style.color = theme.textMuted;
                }}
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
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 400,
                    color: theme.textSubtle,
                    marginLeft: 'auto',
                  }}
                >
                  {group.formations.length}
                </span>
              </button>

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
                          team,
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

/** Look up a formation's display name by its id */
export function getFormationName(formationId: string): string {
  const f = FORMATIONS.find(f => f.id === formationId);
  return f ? f.name : formationId;
}
