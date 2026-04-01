import { useState, useEffect, useCallback } from 'react';
import { useAnalytics } from '../AnalyticsContext';
import { fetchMySessions, deleteSession, fetchSessionClips, getClipThumbnailUrl } from '../services/analysisService';
import type { AnalysisSessionRow } from '../services/analysisService';
import type { SessionClip } from '../types';
import { ConfirmDialog } from './ConfirmDialog';
import { THEME } from '../../constants/colors';

/**
 * Shown when no stream is loaded. Lists previously saved analysis games
 * so the user can resume working on them.
 */
export function SessionBrowser() {
  const { dispatch } = useAnalytics();
  const [sessions, setSessions] = useState<AnalysisSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingSession, setDeletingSession] = useState<AnalysisSessionRow | null>(null);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);

  // Fetch sessions on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchMySessions().then(rows => {
      if (!cancelled) {
        setSessions(rows);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const handleLoad = useCallback(async (session: AnalysisSessionRow) => {
    setLoadingSessionId(session.id);

    // Fetch clips from Supabase
    const clipRows = await fetchSessionClips(session.id);

    // Convert DB rows to SessionClip objects with signed thumbnail URLs
    const clips: SessionClip[] = await Promise.all(
      clipRows.map(async (row) => {
        let thumbnailUrl: string | undefined;
        if (row.thumbnail_path) {
          thumbnailUrl = (await getClipThumbnailUrl(row.thumbnail_path)) ?? undefined;
        }

        return {
          id: row.id,
          type: row.type,
          timestamp: row.timestamp,
          inPoint: row.in_point ?? undefined,
          outPoint: row.out_point ?? undefined,
          thumbnailUrl,
          annotations: row.annotations,
          label: row.label ?? undefined,
          createdAt: new Date(row.created_at).getTime(),
          cloudId: row.id,
          storagePath: row.storage_path,
          thumbnailStoragePath: row.thumbnail_path ?? undefined,
        };
      })
    );

    // Load the session into state
    dispatch({
      type: 'LOAD_SESSION',
      sessionId: session.id,
      sessionName: session.name,
      streamUrl: session.stream_url,
      metadata: session.metadata,
      bookmarks: session.bookmarks,
      clips,
    });

    setLoadingSessionId(null);
  }, [dispatch]);

  const handleDelete = useCallback(async (id: string) => {
    const ok = await deleteSession(id);
    if (ok) {
      setSessions(prev => prev.filter(s => s.id !== id));
    }
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: THEME.textMuted,
        fontSize: 13,
      }}>
        Loading games...
      </div>
    );
  }

  if (sessions.length === 0) {
    return null; // Show default placeholder (VideoPlayer idle state)
  }

  return (
    <div style={{
      padding: '16px 24px',
      maxHeight: '100%',
      overflowY: 'auto',
    }}>
      <div style={{
        fontSize: 12,
        fontWeight: 600,
        color: THEME.textMuted,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: 12,
      }}>
        Previous Games
      </div>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}>
        {sessions.map(session => (
          <div
            key={session.id}
            onClick={() => handleLoad(session)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 14px',
              background: THEME.surfaceRaised,
              border: `1px solid ${THEME.borderSubtle}`,
              borderRadius: 8,
              cursor: loadingSessionId ? 'wait' : 'pointer',
              opacity: loadingSessionId && loadingSessionId !== session.id ? 0.5 : 1,
              transition: 'background 0.1s',
            }}
          >
            {/* Icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={THEME.textMuted} strokeWidth="1.5">
              <polygon points="5,3 19,12 5,21" />
            </svg>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13,
                fontWeight: 500,
                color: THEME.secondary,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {session.name}
              </div>
              <div style={{
                fontSize: 11,
                color: THEME.textMuted,
                marginTop: 2,
                display: 'flex',
                gap: 8,
              }}>
                <span>{session.clip_count} clip{session.clip_count !== 1 ? 's' : ''}</span>
                <span>{session.bookmarks.length} bookmark{session.bookmarks.length !== 1 ? 's' : ''}</span>
                <span>{new Date(session.updated_at).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Loading indicator or delete */}
            {loadingSessionId === session.id ? (
              <span style={{ fontSize: 11, color: THEME.textMuted }}>Loading...</span>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeletingSession(session);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: THEME.textMuted,
                  cursor: 'pointer',
                  padding: 4,
                  opacity: 0.5,
                  fontSize: 16,
                  lineHeight: 1,
                }}
                title="Delete game"
              >
                &times;
              </button>
            )}
          </div>
        ))}
      </div>

      {deletingSession && (
        <ConfirmDialog
          message={`Delete "${deletingSession.name}"? All clips and bookmarks will be lost.`}
          onConfirm={() => {
            handleDelete(deletingSession.id);
            setDeletingSession(null);
          }}
          onCancel={() => setDeletingSession(null)}
        />
      )}
    </div>
  );
}
