import { useState, useEffect, useRef } from 'react';
import { useAppState } from '../../state/AppStateContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { PitchTransform } from '../../types';

/** Lighten a hex color — same formula as PlayerRenderer */
function lightenHex(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + (255 - ((num >> 16) & 0xff)) * amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + (255 - ((num >> 8) & 0xff)) * amount);
  const b = Math.min(255, (num & 0xff) + (255 - (num & 0xff)) * amount);
  return '#' + ((Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).padStart(6, '0');
}

export function PlayerEditPopover({ transform }: { transform: PitchTransform }) {
  const { state, dispatch } = useAppState();
  const theme = useThemeColors();

  const player = state.players.find(p => p.id === state.editingPlayerId);
  const numberRef = useRef<HTMLInputElement>(null);

  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [gkColor, setGkColor] = useState('');

  useEffect(() => {
    if (player) {
      setNumber(player.number.toString());
      setName(player.name);
      if (player.isGK) {
        const teamColor = player.team === 'A' ? state.teamAColor : state.teamBColor;
        setGkColor(player.gkColor ?? lightenHex(teamColor, 0.4));
      }
      // Focus number field on open
      setTimeout(() => numberRef.current?.select(), 0);
    }
  }, [player?.id]);

  if (!player) return null;

  const pos = transform.worldToScreen(player.x, player.y);

  const save = () => {
    const num = parseInt(number, 10);
    if (!isNaN(num) && num >= 0 && num <= 99) {
      dispatch({
        type: 'EDIT_PLAYER',
        playerId: player.id,
        number: num,
        name: name.trim(),
        ...(player.isGK ? { gkColor } : {}),
      });
    }
    dispatch({ type: 'STOP_EDITING' });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      save();
    } else if (e.key === 'Escape') {
      dispatch({ type: 'STOP_EDITING' });
    }
    e.stopPropagation();
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y - 8,
        transform: 'translate(-50%, -100%)',
        background: theme.border,
        border: `1px solid ${theme.highlight}`,
        borderRadius: 8,
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        zIndex: 10,
        minWidth: 140,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
      }}
      onPointerDown={e => e.stopPropagation()}
    >
      {/* Arrow */}
      <div
        style={{
          position: 'absolute',
          bottom: -6,
          left: '50%',
          transform: 'translateX(-50%) rotate(45deg)',
          width: 10,
          height: 10,
          background: theme.border,
          borderRight: `1px solid ${theme.highlight}`,
          borderBottom: `1px solid ${theme.highlight}`,
        }}
      />

      <label style={{ fontSize: 10, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Number
      </label>
      <input
        ref={numberRef}
        type="number"
        min={0}
        max={99}
        value={number}
        onChange={e => setNumber(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%',
          padding: '4px 8px',
          background: theme.inputBg,
          border: `1px solid ${theme.borderSubtle}`,
          borderRadius: 4,
          color: theme.secondary,
          fontSize: 14,
          fontFamily: 'inherit',
          outline: 'none',
        }}
        onFocus={e => { e.target.style.borderColor = theme.highlight; }}
        onBlur={e => { e.target.style.borderColor = theme.borderSubtle; }}
      />

      <label style={{ fontSize: 10, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Name
      </label>
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Optional"
        style={{
          width: '100%',
          padding: '4px 8px',
          background: theme.inputBg,
          border: `1px solid ${theme.borderSubtle}`,
          borderRadius: 4,
          color: theme.secondary,
          fontSize: 14,
          fontFamily: 'inherit',
          outline: 'none',
        }}
        onFocus={e => { e.target.style.borderColor = theme.highlight; }}
        onBlur={e => { e.target.style.borderColor = theme.borderSubtle; }}
      />

      {/* GK jersey color picker — only shown for goalkeepers */}
      {player.isGK && (
        <>
          <label style={{ fontSize: 10, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Jersey Color
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="color"
              value={gkColor}
              onChange={e => setGkColor(e.target.value)}
              style={{
                width: 32,
                height: 28,
                padding: 0,
                border: `1px solid ${theme.borderSubtle}`,
                borderRadius: 4,
                background: 'transparent',
                cursor: 'pointer',
              }}
            />
            <input
              type="text"
              value={gkColor}
              onChange={e => setGkColor(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                flex: 1,
                padding: '4px 8px',
                background: theme.inputBg,
                border: `1px solid ${theme.borderSubtle}`,
                borderRadius: 4,
                color: theme.secondary,
                fontSize: 12,
                fontFamily: 'monospace',
                outline: 'none',
              }}
              onFocus={e => { e.target.style.borderColor = theme.highlight; }}
              onBlur={e => { e.target.style.borderColor = theme.borderSubtle; }}
            />
          </div>
        </>
      )}

      <button
        onClick={save}
        style={{
          marginTop: 2,
          padding: '4px 0',
          background: theme.highlight,
          color: '#0a0e1a',
          border: 'none',
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Save
      </button>
    </div>
  );
}
