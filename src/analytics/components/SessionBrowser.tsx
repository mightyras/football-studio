import { useState, useEffect, useCallback } from 'react';
import { useAnalytics } from '../AnalyticsContext';
import { fetchAllVisibleSessions, fetchSessionEvents, deleteSession, fetchSessionClips, getClipThumbnailUrl, fetchSessionSourceFiles, getSourceFileUrl } from '../services/analysisService';
import type { AnalysisSessionRow } from '../services/analysisService';
import type { SessionClip, Bookmark, SourceFileInfo } from '../types';
import { ConfirmDialog } from './ConfirmDialog';
import { useTeam } from '../../state/TeamContext';
import { useAuth } from '../../state/AuthContext';
import { THEME } from '../../constants/colors';

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

/**
 * Shown when no stream is loaded. Lists previously saved analysis games
 * so the user can resume working on them. Shows a merged list of the
 * user's own sessions plus team-visible sessions (deduplicated).
 */
export function SessionBrowser() {
  const { dispatch } = useAnalytics();
  const { activeTeam } = useTeam();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<AnalysisSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingSession, setDeletingSession] = useState<AnalysisSessionRow | null>(null);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);

  // Fetch merged sessions on mount and when team changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchAllVisibleSessions(activeTeam?.id).then(rows => {
      if (!cancelled) {
        setSessions(rows);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [activeTeam]);

  const handleLoad = useCallback(async (session: AnalysisSessionRow) => {
    setLoadingSessionId(session.id);

    // Fetch clips, events, and source files in parallel
    const fetchSourceFiles = session.source_type === 'uploaded_files'
      ? fetchSessionSourceFiles(session.id)
      : Promise.resolve([]);

    const [clipRows, eventRows, sourceFileRows] = await Promise.all([
      fetchSessionClips(session.id),
      fetchSessionEvents(session.id),
      fetchSourceFiles,
    ]);

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
          ownerId: row.owner_id,
          createdByName: row.owner_display_name ?? undefined,
          cloudId: row.id,
          storagePath: row.storage_path,
          thumbnailStoragePath: row.thumbnail_path ?? undefined,
        };
      })
    );

    // Convert event rows to Bookmark objects
    const bookmarks: Bookmark[] = eventRows.map(row => ({
      id: row.id,
      time: row.time,
      comment: row.comment,
      createdAt: new Date(row.created_at).getTime(),
      category: row.category as Bookmark['category'],
      ownerId: row.owner_id,
      createdByName: row.owner_display_name ?? undefined,
      cloudId: row.id,
      sourceFileId: row.source_file_id ?? undefined,
    }));

    // Convert source file rows
    const sourceFiles: SourceFileInfo[] = sourceFileRows.map(row => ({
      id: row.id,
      fileName: row.file_name,
      storagePath: row.storage_path,
      fileSize: row.file_size ?? undefined,
      sortOrder: row.sort_order,
    }));

    // For uploaded_files sessions, resolve the first file's URL
    let streamUrl = session.stream_url;
    if (session.source_type === 'uploaded_files' && sourceFiles.length > 0) {
      const firstFileUrl = await getSourceFileUrl(sourceFiles[0].storagePath!);
      if (firstFileUrl) {
        streamUrl = firstFileUrl;
      }
    }

    // Extract local file hint from metadata for local_file sessions
    const localFileHint = session.source_type === 'local_file' && session.metadata
      ? (session.metadata as Record<string, unknown>).localFileHint as { fileName: string; fileSize: number; lastModified: number } | undefined
      : undefined;

    // Load the session into state
    dispatch({
      type: 'LOAD_SESSION',
      sessionId: session.id,
      sessionName: session.name,
      sessionOwnerId: session.owner_id,
      streamUrl,
      metadata: session.metadata,
      bookmarks,
      clips,
      sourceType: session.source_type,
      sourceFiles,
      localFileHint: localFileHint ?? null,
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
        {sessions.map(session => {
          const isOwner = session.owner_id === user?.id;
          const meta = session.metadata;
          // Derive display name from team names if available, fall back to session name
          const displayName = (meta?.homeTeam && meta?.awayTeam)
            ? `${meta.homeTeam} - ${meta.awayTeam}`
            : session.name;
          return (
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
              {/* Icon — file icon for local/uploaded, play icon for streams */}
              {session.source_type === 'stream' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={THEME.textMuted} strokeWidth="1.5">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={THEME.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                  <polygon points="10 12 10 18 15 15" />
                </svg>
              )}

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: THEME.secondary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <span>{displayName}</span>
                  {session.last_score && (
                    <span style={{
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                      color: '#ffffff',
                      fontSize: 13,
                      flexShrink: 0,
                    }}>
                      {session.last_score}
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: 11,
                  color: THEME.textMuted,
                  marginTop: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                }}>
                  {session.source_type !== 'stream' && (
                    <span style={{
                      background: 'rgba(139, 92, 246, 0.15)',
                      color: 'rgba(139, 92, 246, 0.9)',
                      borderRadius: 3,
                      padding: '0 5px',
                      fontSize: 10,
                      fontWeight: 600,
                    }}>
                      {session.source_type === 'local_file' ? 'Local file' : 'Uploaded files'}
                    </span>
                  )}
                  {session.metadata?.competition && (
                    <span style={{
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: 'rgba(245, 158, 11, 0.9)',
                      borderRadius: 3,
                      padding: '0 5px',
                      fontSize: 11,
                      fontWeight: 600,
                    }}>
                      {session.metadata.competition}
                    </span>
                  )}
                  {session.metadata?.matchDate && (
                    <span style={{ fontSize: 11, color: 'rgba(59, 130, 246, 0.8)' }}>
                      {formatMatchDate(session.metadata.matchDate)}
                    </span>
                  )}
                  <span>{session.clip_count} clip{session.clip_count !== 1 ? 's' : ''}</span>
                  <span>{session.event_count} event{session.event_count !== 1 ? 's' : ''}</span>
                  <span>{new Date(session.updated_at).toLocaleDateString()}</span>
                </div>
                {/* Creator attribution for sessions by others */}
                {session.owner_display_name && !isOwner && (
                  <div style={{
                    fontSize: 10,
                    color: THEME.textMuted,
                    marginTop: 1,
                    opacity: 0.7,
                  }}>
                    by {session.owner_display_name}
                  </div>
                )}
              </div>

              {/* Loading indicator or delete */}
              {loadingSessionId === session.id ? (
                <span style={{ fontSize: 11, color: THEME.textMuted }}>Loading...</span>
              ) : isOwner ? (
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
              ) : null}
            </div>
          );
        })}
      </div>

      {deletingSession && (
        <ConfirmDialog
          message={`Delete "${deletingSession.name}"? All clips and events will be lost.`}
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
