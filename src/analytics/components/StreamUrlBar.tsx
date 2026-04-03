import { useState, useCallback, useEffect, useRef } from 'react';
import { useAnalytics } from '../AnalyticsContext';
import { useStreamUrlResolver } from '../hooks/useStreamUrlResolver';
import { createSession } from '../services/analysisService';
import { THEME } from '../../constants/colors';

/**
 * URL input bar shown only in idle state (no active session).
 * Session header UI has moved to VideoOverlayHeader.
 */
export function StreamUrlBar() {
  const [inputValue, setInputValue] = useState('');
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
  }, [inputValue, resolveUrl]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLoad();
  }, [handleLoad]);

  const isLoading = state.streamStatus === 'loading' || state.streamStatus === 'resolving';
  const hasSession = state.sessionId !== null || state.streamStatus === 'playing' || state.streamStatus === 'loading' || state.streamStatus === 'resolving' || state.streamStatus === 'error';

  // Session active — header moved to VideoOverlayHeader
  if (hasSession && state.streamUrl) {
    return null;
  }

  // Idle — URL input
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
