import { useState, useEffect } from 'react';
import type { Team, SquadPlayer } from '../../types';
import { useThemeColors } from '../../hooks/useThemeColors';
import * as squadService from '../../services/squadService';

interface SquadPanelProps {
  team: Team;
  onClose: () => void;
}

export function SquadPanel({ team, onClose }: SquadPanelProps) {
  const theme = useThemeColors();
  const [players, setPlayers] = useState<SquadPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNumber, setEditNumber] = useState('');
  const [editName, setEditName] = useState('');
  const [addingNew, setAddingNew] = useState(false);
  const [newNumber, setNewNumber] = useState('');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const teamColor = team.player_color || '#e74c3c';

  useEffect(() => {
    loadPlayers();
  }, [team.id]);

  async function loadPlayers() {
    setLoading(true);
    const data = await squadService.fetchSquadPlayers(team.id);
    setPlayers(data);
    setLoading(false);
  }

  function startEdit(p: SquadPlayer) {
    setEditingId(p.id);
    setEditNumber(p.jersey_number.toString());
    setEditName(p.name);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setError(null);
  }

  async function saveEdit() {
    if (!editingId) return;
    const num = parseInt(editNumber, 10);
    const trimmedName = editName.trim();
    if (isNaN(num) || num < 0 || num > 99) {
      setError('Number must be 0\u201399');
      return;
    }
    if (!trimmedName) {
      setError('Name is required');
      return;
    }
    // Check for duplicate number (excluding current player)
    if (players.some(p => p.id !== editingId && p.jersey_number === num)) {
      setError(`#${num} is already taken`);
      return;
    }
    setSaving(true);
    const ok = await squadService.updateSquadPlayer(editingId, {
      name: trimmedName,
      jersey_number: num,
    });
    setSaving(false);
    if (ok) {
      setEditingId(null);
      setError(null);
      await loadPlayers();
    } else {
      setError('Failed to save');
    }
  }

  async function handleAdd() {
    const num = parseInt(newNumber, 10);
    const trimmedName = newName.trim();
    if (isNaN(num) || num < 0 || num > 99) {
      setError('Number must be 0\u201399');
      return;
    }
    if (!trimmedName) {
      setError('Name is required');
      return;
    }
    if (players.some(p => p.jersey_number === num)) {
      setError(`#${num} is already taken`);
      return;
    }
    setSaving(true);
    const result = await squadService.addSquadPlayer(team.id, trimmedName, num);
    setSaving(false);
    if (result) {
      setAddingNew(false);
      setNewNumber('');
      setNewName('');
      setError(null);
      await loadPlayers();
    } else {
      setError('Failed to add player');
    }
  }

  async function handleRemove(id: string) {
    setSaving(true);
    await squadService.removeSquadPlayer(id);
    setSaving(false);
    await loadPlayers();
  }

  const smallLabelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: theme.textMuted,
    marginBottom: 6,
    display: 'block',
  };

  const inputStyle: React.CSSProperties = {
    padding: '4px 8px',
    fontSize: 12,
    fontFamily: 'inherit',
    background: theme.inputBg,
    border: `1px solid ${theme.borderSubtle}`,
    borderRadius: 4,
    color: theme.secondary,
    outline: 'none',
  };

  const smallBtnStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    padding: '2px 6px',
    borderRadius: 3,
    fontFamily: 'inherit',
    lineHeight: 1,
  };

  function handleEditKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') cancelEdit();
    e.stopPropagation();
  }

  function handleAddKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleAdd();
    if (e.key === 'Escape') {
      setAddingNew(false);
      setError(null);
    }
    e.stopPropagation();
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2100,
      }}
      onKeyDown={e => e.stopPropagation()}
      onKeyUp={e => e.stopPropagation()}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: theme.surface,
          border: `1px solid ${theme.borderSubtle}`,
          borderRadius: 8,
          width: '90%',
          maxWidth: 420,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header — sticky */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '16px 20px',
            borderBottom: `1px solid ${theme.border}`,
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: theme.textSubtle,
              cursor: 'pointer',
              fontSize: 18,
              padding: 0,
              lineHeight: 1,
              fontFamily: 'inherit',
            }}
            title="Close"
          >
            &#x2039;
          </button>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: theme.secondary }}>
            Team Squad
          </h3>
          <span style={{ fontSize: 11, color: theme.textSubtle, marginLeft: 'auto' }}>
            {players.length} player{players.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', minHeight: 0 }}>
          <span style={smallLabelStyle}>Players</span>

          {loading && (
            <div style={{ fontSize: 12, color: theme.textSubtle, textAlign: 'center', padding: 16 }}>
              Loading...
            </div>
          )}

          {!loading && players.length === 0 && !addingNew && (
            <div style={{ fontSize: 12, color: theme.textSubtle, textAlign: 'center', padding: 16 }}>
              No players in squad yet.
            </div>
          )}

          {/* Player list */}
          {players.map(p => (
            <div key={p.id}>
              {editingId === p.id ? (
                /* Editing row */
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={editNumber}
                    onChange={e => setEditNumber(e.target.value)}
                    onKeyDown={handleEditKeyDown}
                    autoFocus
                    style={{ ...inputStyle, width: 48, textAlign: 'center' }}
                    onFocus={e => { e.target.style.borderColor = theme.highlight; }}
                    onBlur={e => { e.target.style.borderColor = theme.borderSubtle; }}
                  />
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={handleEditKeyDown}
                    placeholder="Name"
                    style={{ ...inputStyle, flex: 1 }}
                    onFocus={e => { e.target.style.borderColor = theme.highlight; }}
                    onBlur={e => { e.target.style.borderColor = theme.borderSubtle; }}
                  />
                  <button
                    onClick={saveEdit}
                    disabled={saving}
                    style={{ ...smallBtnStyle, color: '#22c55e' }}
                    title="Save"
                  >
                    &#x2713;
                  </button>
                  <button
                    onClick={cancelEdit}
                    style={{ ...smallBtnStyle, color: theme.textSubtle }}
                    title="Cancel"
                  >
                    &#x2715;
                  </button>
                </div>
              ) : (
                /* Display row */
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: teamColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#fff',
                      flexShrink: 0,
                    }}
                  >
                    {p.jersey_number}
                  </div>
                  <span style={{ flex: 1, fontSize: 13, color: theme.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </span>
                  <button
                    onClick={() => startEdit(p)}
                    style={{ ...smallBtnStyle, color: theme.textMuted }}
                    title="Edit"
                    onMouseEnter={e => { e.currentTarget.style.color = theme.secondary; }}
                    onMouseLeave={e => { e.currentTarget.style.color = theme.textMuted; }}
                  >
                    &#x270E;
                  </button>
                  <button
                    onClick={() => handleRemove(p.id)}
                    disabled={saving}
                    style={{ ...smallBtnStyle, color: theme.textMuted }}
                    title="Remove"
                    onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = theme.textMuted; }}
                  >
                    &#x2715;
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Add new player row */}
          {addingNew && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <input
                type="number"
                min={0}
                max={99}
                value={newNumber}
                onChange={e => setNewNumber(e.target.value)}
                onKeyDown={handleAddKeyDown}
                autoFocus
                placeholder="#"
                style={{ ...inputStyle, width: 48, textAlign: 'center' }}
                onFocus={e => { e.target.style.borderColor = theme.highlight; }}
                onBlur={e => { e.target.style.borderColor = theme.borderSubtle; }}
              />
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={handleAddKeyDown}
                placeholder="Player name"
                style={{ ...inputStyle, flex: 1 }}
                onFocus={e => { e.target.style.borderColor = theme.highlight; }}
                onBlur={e => { e.target.style.borderColor = theme.borderSubtle; }}
              />
              <button
                onClick={handleAdd}
                disabled={saving}
                style={{ ...smallBtnStyle, color: '#22c55e' }}
                title="Add"
              >
                &#x2713;
              </button>
              <button
                onClick={() => { setAddingNew(false); setError(null); }}
                style={{ ...smallBtnStyle, color: theme.textSubtle }}
                title="Cancel"
              >
                &#x2715;
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ fontSize: 11, color: '#ef4444', padding: '0 4px' }}>
              {error}
            </div>
          )}

          {/* Add Player button */}
          {!addingNew && (
            <button
              onClick={() => { setAddingNew(true); setError(null); }}
              style={{
                marginTop: 4,
                padding: '8px 0',
                fontSize: 12,
                fontFamily: 'inherit',
                border: `1px dashed ${theme.borderSubtle}`,
                borderRadius: 6,
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
              + Add Player
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
