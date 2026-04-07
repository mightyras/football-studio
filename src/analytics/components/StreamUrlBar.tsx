import { useState, useCallback, useEffect, useRef } from 'react';
import { useAnalytics } from '../AnalyticsContext';
import { useStreamUrlResolver } from '../hooks/useStreamUrlResolver';
import { createSession } from '../services/analysisService';
import { useTeam } from '../../state/TeamContext';
import { useFileUpload } from '../hooks/useFileUpload';
import { THEME } from '../../constants/colors';

/**
 * URL input bar shown only in idle state (no active session).
 * Session header UI has moved to VideoOverlayHeader.
 */
export function StreamUrlBar() {
  const [inputValue, setInputValue] = useState('');
  const { state, dispatch } = useAnalytics();
  const { resolveUrl } = useStreamUrlResolver();
  const { activeTeam } = useTeam();
  const { handleFiles, uploading, uploadProgress, uploadStatus } = useFileUpload();
  const sessionCreatedForUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-create a session when a stream starts playing (and we don't already have one)
  useEffect(() => {
    if (
      state.streamStatus === 'playing' &&
      !state.sessionId &&
      state.streamUrl &&
      state.sourceType === 'stream' &&
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

      createSession(name, state.streamUrl, meta ?? null, activeTeam?.id).then(row => {
        if (row) {
          dispatch({ type: 'SET_SESSION', id: row.id, name: row.name, ownerId: row.owner_id });
        }
      });
    }
  }, [state.streamStatus, state.sessionId, state.streamUrl, state.sourceType, state.urlMetadata, activeTeam, dispatch]);

  const handleLoad = useCallback(() => {
    const url = inputValue.trim();
    if (!url) return;
    sessionCreatedForUrlRef.current = null;
    setInputValue('');
    resolveUrl(url);
  }, [inputValue, resolveUrl]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLoad();
  }, [handleLoad]);

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    handleFiles(Array.from(files));
    // Reset input so the same file(s) can be re-selected
    e.target.value = '';
  }, [handleFiles]);

  const isLoading = state.streamStatus === 'loading' || state.streamStatus === 'resolving';
  const hasSession = state.sessionId !== null || state.streamStatus === 'playing' || state.streamStatus === 'loading' || state.streamStatus === 'resolving' || state.streamStatus === 'error';

  // Session active — header moved to VideoOverlayHeader (but keep showing during upload)
  if (!uploading && hasSession && (state.streamUrl || state.sourceType !== 'stream')) {
    return null;
  }

  // Uploading — progress bar
  if (uploading) {
    return (
      <div style={{
        display: 'flex',
        gap: 8,
        padding: '8px 12px',
        background: THEME.surface,
        borderBottom: `1px solid ${THEME.borderSubtle}`,
        alignItems: 'center',
      }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
            color: THEME.secondary,
          }}>
            <span>Uploading {uploadStatus}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{uploadProgress}%</span>
          </div>
          <div style={{
            height: 4,
            background: THEME.surfaceHover,
            borderRadius: 2,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${uploadProgress}%`,
              background: THEME.highlight,
              borderRadius: 2,
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      </div>
    );
  }

  // Idle — URL input + file picker
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
          whiteSpace: 'nowrap',
        }}
      >
        {isLoading ? (state.streamStatus === 'resolving' ? 'Detecting...' : 'Loading...') : 'Load Stream'}
      </button>

      <div style={{
        width: 1,
        height: 24,
        background: THEME.borderSubtle,
        flexShrink: 0,
      }} />

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        multiple
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <button
        onClick={handleFileSelect}
        disabled={isLoading}
        style={{
          padding: '8px 16px',
          background: THEME.surfaceRaised,
          color: THEME.secondary,
          border: `1px solid ${THEME.borderSubtle}`,
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 500,
          fontFamily: 'inherit',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        Open File(s)
      </button>
    </div>
  );
}
