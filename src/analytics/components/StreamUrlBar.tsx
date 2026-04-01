import { useState, useCallback, useEffect, useRef } from 'react';
import { useAnalytics } from '../AnalyticsContext';
import { useStreamUrlResolver } from '../hooks/useStreamUrlResolver';
import { getPlatformDisplayName } from '../utils/urlDetector';
import { createSession, updateSession } from '../services/analysisService';
import { THEME } from '../../constants/colors';

/**
 * Two-mode component:
 * - Mode 1 (idle): Full URL input + Load button
 * - Mode 2 (session active): Compact header with editable name, metadata, URL popover
 */
export function StreamUrlBar() {
  const [inputValue, setInputValue] = useState('');
  const [urlPopoverOpen, setUrlPopoverOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const { state, dispatch } = useAnalytics();
  const { resolveUrl } = useStreamUrlResolver();
  const sessionCreatedForUrlRef = useRef<string | null>(null);

  // Auto-create a session when a stream starts playing (and we don't already have one)
  useEffect(() => {
    if (
      state.streamStatus === 'playing' &&
      !state.sessionId &&
      state.streamUrl &&
      sessionCreatedForUrlRef.current !== state.streamUrl
    ) {
      sessionCreatedForUrlRef.current = state.streamUrl;
      const meta = state.urlMetadata;
      let name = 'Untitled Game';
      if (meta?.homeTeam && meta?.awayTeam) {
        name = `${meta.homeTeam} vs ${meta.awayTeam}`;
      } else if (meta?.homeTeam) {
        name = meta.homeTeam;
      } else if (meta?.matchDate) {
        name = `Match ${meta.matchDate}`;
      }

      createSession(name, state.streamUrl, meta ?? null).then(row => {
        if (row) {
          dispatch({ type: 'SET_SESSION', id: row.id, name: row.name });
        }
      });
    }
  }, [state.streamStatus, state.sessionId, state.streamUrl, state.urlMetadata, dispatch]);

  const handleLoad = useCallback(() => {
    const url = inputValue.trim();
    if (!url) return;
    sessionCreatedForUrlRef.current = null;
    resolveUrl(url);
    setUrlPopoverOpen(false);
  }, [inputValue, resolveUrl]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLoad();
    if (e.key === 'Escape') setUrlPopoverOpen(false);
  }, [handleLoad]);

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

  const handleUrlUpdate = useCallback(() => {
    const url = inputValue.trim();
    if (!url || !state.sessionId) return;
    // Update the stream URL in the DB and re-resolve
    updateSession(state.sessionId, { streamUrl: url });
    resolveUrl(url);
    setUrlPopoverOpen(false);
  }, [inputValue, state.sessionId, resolveUrl]);

  const isLoading = state.streamStatus === 'loading' || state.streamStatus === 'resolving';
  const meta = state.urlMetadata;
  const hasSession = state.sessionId !== null || state.streamStatus === 'playing' || state.streamStatus === 'loading' || state.streamStatus === 'resolving' || state.streamStatus === 'error';

  // Derive display name from session name or metadata
  const displayName = state.sessionName
    || (meta?.homeTeam && meta?.awayTeam ? `${meta.homeTeam} vs ${meta.awayTeam}` : null)
    || meta?.homeTeam
    || (meta?.matchDate ? `Match ${meta.matchDate}` : null)
    || 'Untitled Game';

  // ─── Mode 2: Session active — compact header ───
  if (hasSession && state.streamUrl) {
    return (
      <div style={{
        background: THEME.surface,
        borderBottom: `1px solid ${THEME.borderSubtle}`,
        position: 'relative',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '5px 12px',
          minHeight: 32,
        }}>
          {/* Platform badge */}
          {meta?.platform && (
            <span style={{
              background: THEME.surfaceHover,
              border: `1px solid ${THEME.borderSubtle}`,
              borderRadius: 4,
              padding: '1px 6px',
              fontSize: 9,
              fontWeight: 600,
              color: THEME.secondary,
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
              onChange={e => setNameValue(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={e => {
                if (e.key === 'Enter') handleNameSave();
                if (e.key === 'Escape') setEditingName(false);
                e.stopPropagation();
              }}
              style={{
                flex: 1,
                padding: '2px 8px',
                background: THEME.surfaceRaised,
                border: `1px solid ${THEME.highlight}`,
                borderRadius: 4,
                color: THEME.secondary,
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'inherit',
                outline: 'none',
                minWidth: 0,
              }}
            />
          ) : (
            <span
              onClick={() => {
                setNameValue(state.sessionName || displayName);
                setEditingName(true);
              }}
              style={{
                flex: 1,
                fontSize: 13,
                fontWeight: 600,
                color: THEME.secondary,
                cursor: 'text',
                padding: '2px 0',
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title="Click to rename"
            >
              {displayName}
            </span>
          )}

          {/* Match date */}
          {meta?.matchDate && (
            <span style={{ fontSize: 10, color: THEME.textMuted, flexShrink: 0 }}>
              {meta.matchDate}
            </span>
          )}

          {/* Save status */}
          {state.saveStatus !== 'idle' && (
            <span style={{
              fontSize: 10,
              color: state.saveStatus === 'error' ? '#ef4444'
                : state.saveStatus === 'saving' ? THEME.textMuted
                : '#22c55e',
              flexShrink: 0,
            }}>
              {state.saveStatus === 'saving' ? 'Saving...'
                : state.saveStatus === 'saved' ? 'Saved'
                : 'Error'}
            </span>
          )}

          {/* URL button — opens popover to change stream URL */}
          <button
            onClick={() => {
              setInputValue(state.streamUrl || '');
              setUrlPopoverOpen(prev => !prev);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: THEME.textMuted,
              cursor: 'pointer',
              padding: 4,
              flexShrink: 0,
              opacity: 0.6,
              display: 'flex',
              alignItems: 'center',
            }}
            title="Change stream URL"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </button>
        </div>

        {/* URL popover */}
        {urlPopoverOpen && (
          <div style={{
            padding: '6px 12px 8px',
            borderTop: `1px solid ${THEME.borderSubtle}`,
            display: 'flex',
            gap: 6,
            alignItems: 'center',
          }}>
            <input
              autoFocus
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste new stream URL..."
              style={{
                flex: 1,
                padding: '6px 10px',
                background: THEME.surfaceRaised,
                border: `1px solid ${THEME.borderSubtle}`,
                borderRadius: 4,
                color: THEME.secondary,
                fontSize: 12,
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            <button
              onClick={state.sessionId ? handleUrlUpdate : handleLoad}
              disabled={!inputValue.trim()}
              style={{
                padding: '6px 12px',
                background: THEME.highlight,
                color: '#000',
                border: 'none',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'inherit',
                cursor: 'pointer',
                opacity: !inputValue.trim() ? 0.5 : 1,
              }}
            >
              Update
            </button>
            <button
              onClick={() => setUrlPopoverOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: THEME.textMuted,
                cursor: 'pointer',
                padding: 2,
                fontSize: 16,
                lineHeight: 1,
              }}
            >
              &times;
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─── Mode 1: Idle — URL input ───
  return (
    <div style={{
      display: 'flex',
      gap: 8,
      padding: '8px 12px',
      background: THEME.surface,
      borderBottom: `1px solid ${THEME.borderSubtle}`,
      alignItems: 'center',
    }}>
      <input
        type="text"
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Paste stream URL (.m3u8) or page URL (fotbollplay.se, veo.co...)"
        disabled={isLoading}
        style={{
          flex: 1,
          padding: '8px 12px',
          background: THEME.surfaceRaised,
          border: `1px solid ${THEME.borderSubtle}`,
          borderRadius: 6,
          color: THEME.secondary,
          fontSize: 13,
          fontFamily: 'inherit',
          outline: 'none',
        }}
      />
      <button
        onClick={handleLoad}
        disabled={!inputValue.trim() || isLoading}
        style={{
          padding: '8px 16px',
          background: isLoading ? THEME.surfaceHover : THEME.highlight,
          color: isLoading ? THEME.textMuted : '#000',
          border: 'none',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 600,
          fontFamily: 'inherit',
          cursor: isLoading ? 'wait' : 'pointer',
          opacity: !inputValue.trim() ? 0.5 : 1,
        }}
      >
        {isLoading ? (state.streamStatus === 'resolving' ? 'Detecting...' : 'Loading...') : 'Load Stream'}
      </button>
    </div>
  );
}
