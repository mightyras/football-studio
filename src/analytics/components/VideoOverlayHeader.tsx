import { useState, useCallback } from 'react';
import { useAnalytics } from '../AnalyticsContext';
import { getPlatformDisplayName } from '../utils/urlDetector';
import { updateSession } from '../services/analysisService';
import { THEME } from '../../constants/colors';

export function VideoOverlayHeader() {
  const { state, dispatch } = useAnalytics();
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');

  const meta = state.urlMetadata;
  const hasSession = state.sessionId !== null || state.streamStatus === 'playing';

  const displayName = state.sessionName
    || (meta?.homeTeam && meta?.awayTeam ? `${meta.homeTeam} vs ${meta.awayTeam}` : null)
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

  if (!hasSession) return null;

  return (
      <div style={{
        position: 'absolute',
        top: 10,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 5,
        pointerEvents: 'auto',
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
      }}>
        {/* Platform badge */}
        {meta?.platform && (
          <span style={{
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: 3,
            padding: '1px 6px',
            fontSize: 9,
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
            fontSize: 9,
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
      </div>
  );
}
