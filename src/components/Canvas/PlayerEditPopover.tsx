import { useState, useEffect, useRef } from 'react';
import { useAppState } from '../../state/AppStateContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { PitchTransform } from '../../types';

export function PlayerEditPopover({ transform }: { transform: PitchTransform }) {
  const { state, dispatch } = useAppState();
  const theme = useThemeColors();

  const player = state.players.find(p => p.id === state.editingPlayerId);
  const numberRef = useRef<HTMLInputElement>(null);

  const [number, setNumber] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    if (player) {
      setNumber(player.number.toString());
      setName(player.name);
      // Focus number field on open
      setTimeout(() => numberRef.current?.select(), 0);
    }
  }, [player?.id]);

  if (!player) return null;

  const pos = transform.worldToScreen(player.x, player.y);

  const save = () => {
    const num = parseInt(number, 10);
    if (!isNaN(num) && num >= 0 && num <= 99) {
      dispatch({ type: 'EDIT_PLAYER', playerId: player.id, number: num, name: name.trim() });
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
        background: '#1e293b',
        border: `1px solid ${theme.accent}`,
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
          background: '#1e293b',
          borderRight: `1px solid ${theme.accent}`,
          borderBottom: `1px solid ${theme.accent}`,
        }}
      />

      <label style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
          background: '#0f172a',
          border: '1px solid #334155',
          borderRadius: 4,
          color: '#e2e8f0',
          fontSize: 14,
          fontFamily: 'inherit',
          outline: 'none',
        }}
        onFocus={e => { e.target.style.borderColor = theme.accent; }}
        onBlur={e => { e.target.style.borderColor = '#334155'; }}
      />

      <label style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
          background: '#0f172a',
          border: '1px solid #334155',
          borderRadius: 4,
          color: '#e2e8f0',
          fontSize: 14,
          fontFamily: 'inherit',
          outline: 'none',
        }}
        onFocus={e => { e.target.style.borderColor = theme.accent; }}
        onBlur={e => { e.target.style.borderColor = '#334155'; }}
      />

      <button
        onClick={save}
        style={{
          marginTop: 2,
          padding: '4px 0',
          background: theme.accent,
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
