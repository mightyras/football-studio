import { useMemo, useState, useCallback } from 'react';
import { useAnalytics } from '../AnalyticsContext';
import { updateSession } from '../services/analysisService';
import type { UrlMetadata } from '../types';

/** Parse "X - Y" score string from a goal bookmark comment. */
function parseScore(comment: string): { home: number; away: number } | null {
  const m = comment.match(/^(\d+)\s*-\s*(\d+)$/);
  if (!m) return null;
  return { home: parseInt(m[1], 10), away: parseInt(m[2], 10) };
}

function ensureMetadata(partial: UrlMetadata | null): UrlMetadata {
  return {
    platform: partial?.platform ?? null,
    homeTeam: partial?.homeTeam ?? null,
    awayTeam: partial?.awayTeam ?? null,
    matchDate: partial?.matchDate ?? null,
    competition: partial?.competition ?? null,
    rawSlug: partial?.rawSlug ?? null,
  };
}

export function MatchResultsPanel() {
  const { state, dispatch } = useAnalytics();

  const [editingField, setEditingField] = useState<'home' | 'away' | null>(null);
  const [editValue, setEditValue] = useState('');

  const score = useMemo(() => {
    let latest: { home: number; away: number } | null = null;
    let latestTime = -1;
    for (const b of state.bookmarks) {
      if (b.category === 'goal' && b.time <= state.currentTime && b.time > latestTime) {
        const parsed = parseScore(b.comment);
        if (parsed) {
          latest = parsed;
          latestTime = b.time;
        }
      }
    }
    return latest ?? { home: 0, away: 0 };
  }, [state.bookmarks, state.currentTime]);

  const homeName = state.urlMetadata?.homeTeam || '';
  const awayName = state.urlMetadata?.awayTeam || '';

  const saveTeamName = useCallback((field: 'home' | 'away', value: string) => {
    const trimmed = value.trim();
    const newMeta = {
      ...ensureMetadata(state.urlMetadata),
      [field === 'home' ? 'homeTeam' : 'awayTeam']: trimmed || null,
    };
    dispatch({ type: 'SET_URL_METADATA', metadata: newMeta });

    const h = field === 'home' ? trimmed : (state.urlMetadata?.homeTeam || '');
    const a = field === 'away' ? trimmed : (state.urlMetadata?.awayTeam || '');
    const sessionName = h && a ? `${h} - ${a}` : h || a || '';
    if (sessionName) {
      dispatch({ type: 'SET_SESSION_NAME', name: sessionName });
    }

    if (state.sessionId) {
      const updates: { name?: string; metadata: UrlMetadata } = { metadata: newMeta };
      if (sessionName) updates.name = sessionName;
      updateSession(state.sessionId, updates);
    }

    setEditingField(null);
  }, [state.urlMetadata, state.sessionId, dispatch]);

  const startEditing = useCallback((field: 'home' | 'away') => {
    setEditValue(field === 'home' ? homeName : awayName);
    setEditingField(field);
  }, [homeName, awayName]);

  const hasSession = state.sessionId !== null || state.streamStatus === 'playing';
  if (!hasSession) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 10,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 5,
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: 8,
        padding: '8px 20px 6px',
        whiteSpace: 'nowrap',
      }}
    >
      {/* Score row: [Home] X - Y [Away] */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <EditableTeamName
          value={homeName}
          placeholder="Home"
          editing={editingField === 'home'}
          editValue={editValue}
          onEditChange={setEditValue}
          onStartEdit={() => startEditing('home')}
          onSave={() => saveTeamName('home', editValue)}
          onCancel={() => setEditingField(null)}
          align="right"
        />

        <span style={{
          fontFamily: 'inherit',
          fontSize: 24,
          fontWeight: 800,
          color: '#ffffff',
          letterSpacing: '1px',
          fontVariantNumeric: 'tabular-nums',
          minWidth: 56,
          textAlign: 'center',
        }}>
          {score.home} - {score.away}
        </span>

        <EditableTeamName
          value={awayName}
          placeholder="Away"
          editing={editingField === 'away'}
          editValue={editValue}
          onEditChange={setEditValue}
          onStartEdit={() => startEditing('away')}
          onSave={() => saveTeamName('away', editValue)}
          onCancel={() => setEditingField(null)}
          align="left"
        />
      </div>
    </div>
  );
}

function EditableTeamName({
  value,
  placeholder,
  editing,
  editValue,
  onEditChange,
  onStartEdit,
  onSave,
  onCancel,
  align,
}: {
  value: string;
  placeholder: string;
  editing: boolean;
  editValue: string;
  onEditChange: (v: string) => void;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  align: 'left' | 'right';
}) {
  if (editing) {
    return (
      <input
        autoFocus
        type="text"
        value={editValue}
        onChange={e => onEditChange(e.target.value)}
        onBlur={onSave}
        onKeyDown={e => {
          if (e.key === 'Enter') onSave();
          if (e.key === 'Escape') onCancel();
          e.stopPropagation();
        }}
        style={{
          width: 110,
          padding: '2px 6px',
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          borderRadius: 4,
          color: '#fff',
          fontSize: 15,
          fontWeight: 600,
          fontFamily: 'inherit',
          outline: 'none',
          textAlign: align,
        }}
      />
    );
  }

  return (
    <span
      onClick={onStartEdit}
      title="Click to edit team name"
      style={{
        fontSize: 15,
        fontWeight: 600,
        color: value ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.35)',
        maxWidth: 120,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        textAlign: align,
        cursor: 'text',
      }}
    >
      {value || placeholder}
    </span>
  );
}
