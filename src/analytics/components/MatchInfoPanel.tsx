import { useState, useCallback } from 'react';
import { useAnalytics } from '../AnalyticsContext';
import { updateSession } from '../services/analysisService';
import { CompetitionPicker } from './CompetitionPicker';
import { THEME } from '../../constants/colors';
import type { UrlMetadata } from '../types';

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

function formatMatchDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function MatchInfoPanel() {
  const { state, dispatch } = useAnalytics();
  const [editingDate, setEditingDate] = useState(false);
  const [dateValue, setDateValue] = useState('');
  const [showCompetitionPicker, setShowCompetitionPicker] = useState(false);

  const meta = state.urlMetadata;
  const hasSession = state.sessionId !== null || state.streamStatus === 'playing';

  const updateMetadata = useCallback((patch: Partial<UrlMetadata>) => {
    const newMeta = { ...ensureMetadata(state.urlMetadata), ...patch };
    dispatch({ type: 'SET_URL_METADATA', metadata: newMeta });
    if (state.sessionId) {
      updateSession(state.sessionId, { metadata: newMeta });
    }
  }, [state.urlMetadata, state.sessionId, dispatch]);

  const handleCompetitionSelect = useCallback((competition: string) => {
    updateMetadata({ competition });
    setShowCompetitionPicker(false);
  }, [updateMetadata]);

  const handleCompetitionClear = useCallback(() => {
    updateMetadata({ competition: null });
    setShowCompetitionPicker(false);
  }, [updateMetadata]);

  const handleDateSave = useCallback(() => {
    const trimmed = dateValue.trim();
    updateMetadata({ matchDate: trimmed || null });
    setEditingDate(false);
  }, [dateValue, updateMetadata]);

  if (!hasSession) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 5,
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 4,
      }}
    >
      {/* Match info plate */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: 6,
        padding: '5px 12px',
        whiteSpace: 'nowrap',
        position: 'relative',
      }}>
        <span
          onClick={() => setShowCompetitionPicker(true)}
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: meta?.competition ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.3)',
            cursor: 'pointer',
            borderRight: '1px solid rgba(255, 255, 255, 0.12)',
            paddingRight: 6,
          }}
          title={meta?.competition ? 'Click to change competition' : 'Set competition'}
        >
          {meta?.competition || '+ Competition'}
        </span>

        {editingDate ? (
          <input
            autoFocus
            type="date"
            value={dateValue}
            onChange={e => setDateValue(e.target.value)}
            onBlur={handleDateSave}
            onKeyDown={e => {
              if (e.key === 'Enter') handleDateSave();
              if (e.key === 'Escape') { setEditingDate(false); }
              e.stopPropagation();
            }}
            style={{
              padding: '1px 4px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: `1px solid ${THEME.highlight}`,
              borderRadius: 3,
              color: '#fff',
              fontSize: 11,
              fontWeight: 500,
              fontFamily: 'inherit',
              outline: 'none',
              colorScheme: 'dark',
            }}
          />
        ) : (
          <span
            onClick={() => {
              setDateValue(meta?.matchDate || '');
              setEditingDate(true);
            }}
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: meta?.matchDate ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.3)',
              cursor: 'pointer',
            }}
            title={meta?.matchDate ? 'Click to change date' : 'Set match date'}
          >
            {meta?.matchDate ? formatMatchDate(meta.matchDate) : '+ Date'}
          </span>
        )}

        {showCompetitionPicker && (
          <CompetitionPicker
            currentValue={meta?.competition ?? null}
            onSelect={handleCompetitionSelect}
            onClear={handleCompetitionClear}
            onDismiss={() => setShowCompetitionPicker(false)}
          />
        )}
      </div>
    </div>
  );
}
