import { useState, useCallback } from 'react';
import { useAnalytics } from '../AnalyticsContext';
import { getPlatformDisplayName } from '../utils/urlDetector';
import { updateSession } from '../services/analysisService';
import { CompetitionPicker } from './CompetitionPicker';
import { THEME } from '../../constants/colors';
import type { UrlMetadata } from '../types';

/** Build a full metadata object, filling in nulls for missing fields. */
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

/** Format a YYYY-MM-DD date string to locale short format, e.g. "Sat 4 Apr 2025". */
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

export function VideoOverlayHeader() {
  const { state, dispatch } = useAnalytics();
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [editingDate, setEditingDate] = useState(false);
  const [dateValue, setDateValue] = useState('');
  const [showCompetitionPicker, setShowCompetitionPicker] = useState(false);

  const meta = state.urlMetadata;
  const hasSession = state.sessionId !== null || state.streamStatus === 'playing';

  const displayName = state.sessionName
    || (meta?.homeTeam && meta?.awayTeam ? `${meta.homeTeam} - ${meta.awayTeam}` : null)
    || meta?.homeTeam
    || (meta?.matchDate ? `Match ${meta.matchDate}` : null)
    || 'Untitled Game';

  const handleNameSave = useCallback(() => {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== state.sessionName) {
      dispatch({ type: 'SET_SESSION_NAME', name: trimmed });
      if (state.sessionId) {
        updateSession(state.sessionId, { name: trimmed });
      }
    }
    setEditingName(false);
  }, [nameValue, state.sessionName, state.sessionId, dispatch]);

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

  const plateStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(0, 0, 0, 0.45)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: 6,
    padding: '5px 14px',
    whiteSpace: 'nowrap',
  };

  return (
      <div style={{
        position: 'absolute',
        top: 10,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 5,
        pointerEvents: 'auto',
        ...plateStyle,
      }}>
          {/* Platform badge */}
          {meta?.platform && (
            <span style={{
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: 3,
              padding: '2px 7px',
              fontSize: 10,
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.5)',
              textTransform: 'uppercase',
              letterSpacing: '0.3px',
              flexShrink: 0,
            }}>
              {getPlatformDisplayName(meta.platform)}
            </span>
          )}

          {/* Editable session name */}
          {editingName ? (
            <input
              autoFocus
              type="text"
              value={nameValue}
              size={Math.max(20, nameValue.length + 2)}
              onChange={e => setNameValue(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={e => {
                if (e.key === 'Enter') handleNameSave();
                if (e.key === 'Escape') setEditingName(false);
                e.stopPropagation();
              }}
              style={{
                padding: '2px 6px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: `1px solid ${THEME.highlight}`,
                borderRadius: 4,
                color: '#fff',
                fontSize: 17,
                fontWeight: 600,
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
          ) : (
            <span
              onClick={() => {
                setNameValue(state.sessionName || displayName);
                setEditingName(true);
              }}
              style={{
                fontSize: 17,
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.9)',
                cursor: 'text',
              }}
              title="Click to rename"
            >
              {displayName}
            </span>
          )}

          {/* Save status */}
          {state.saveStatus !== 'idle' && (
            <span style={{
              fontSize: 10,
              color: state.saveStatus === 'error' ? '#ef4444'
                : state.saveStatus === 'saving' ? 'rgba(255,255,255,0.4)'
                : '#22c55e',
              flexShrink: 0,
            }}>
              {state.saveStatus === 'saving' ? 'Saving...'
                : state.saveStatus === 'saved' ? 'Saved'
                : 'Error'}
            </span>
          )}

        {/* Match info plate — anchored to the right of the name plate */}
        <div style={{ ...plateStyle, padding: '5px 12px', gap: 6, position: 'absolute', left: '100%', marginLeft: 10, top: 0 }}>
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

          {/* Competition picker popover */}
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
