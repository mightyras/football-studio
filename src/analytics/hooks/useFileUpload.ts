import { useState, useCallback } from 'react';
import { useAnalytics } from '../AnalyticsContext';
import { useTeam } from '../../state/TeamContext';
import { createSession, uploadSourceFile, getSourceFileUrl } from '../services/analysisService';
import type { SourceFileInfo } from '../types';

const MAX_UPLOAD_SIZE = 50 * 1024 * 1024; // 50 MB — Supabase free plan limit

/**
 * Handles local video file selection:
 * - Single file → local-only playback via Object URL (no upload)
 * - Multiple files → uploaded to Supabase Storage (files > 50MB kept local with Object URLs)
 */
export function useFileUpload() {
  const { dispatch } = useAnalytics();
  const { activeTeam } = useTeam();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');

  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    if (files.length === 1) {
      // ── Single file: local-only playback ──
      const file = files[0];
      const objectUrl = URL.createObjectURL(file);

      dispatch({ type: 'SET_SOURCE_TYPE', sourceType: 'local_file' });
      dispatch({
        type: 'SET_LOCAL_FILE_HINT',
        hint: { fileName: file.name, fileSize: file.size, lastModified: file.lastModified },
      });

      // Create session immediately — store file hint in metadata for re-selection
      const name = file.name.replace(/\.[^.]+$/, ''); // strip extension
      const metadata = {
        platform: null,
        homeTeam: null,
        awayTeam: null,
        matchDate: null,
        competition: null,
        rawSlug: null,
        localFileHint: { fileName: file.name, fileSize: file.size, lastModified: file.lastModified },
      };
      const row = await createSession(
        name,
        null,
        metadata as any,
        activeTeam?.id,
        'local_file',
      );

      if (row) {
        dispatch({ type: 'SET_SESSION', id: row.id, name: row.name, ownerId: row.owner_id });
      }

      // Set the Object URL as resolved stream — useHlsPlayer handles MP4 natively
      dispatch({ type: 'SET_RESOLVED_STREAM_URL', url: objectUrl });
      dispatch({ type: 'SET_STREAM_STATUS', status: 'loading' });
    } else {
      // ── Multiple files ──
      setUploading(true);
      setUploadProgress(0);

      // Sort files alphabetically for consistent ordering
      const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name));

      // Create session first
      const firstName = sorted[0].name.replace(/\.[^.]+$/, '');
      const name = sorted.length === 2
        ? `${firstName} (+1 more)`
        : `${firstName} (+${sorted.length - 1} more)`;

      // Check if any files are too large to upload
      const hasOversized = sorted.some(f => f.size > MAX_UPLOAD_SIZE);
      const sourceType = hasOversized ? 'local_file' : 'uploaded_files';

      const row = await createSession(
        name,
        null,
        null,
        activeTeam?.id,
        sourceType,
      );

      if (!row) {
        setUploading(false);
        return;
      }

      dispatch({ type: 'SET_SESSION', id: row.id, name: row.name, ownerId: row.owner_id });
      dispatch({ type: 'SET_SOURCE_TYPE', sourceType });

      // Process files — upload small ones, create Object URLs for large ones
      const sourceFiles: SourceFileInfo[] = [];
      for (let i = 0; i < sorted.length; i++) {
        const file = sorted[i];
        const shortName = file.name.replace(/\.[^.]+$/, '');
        setUploadProgress(Math.round((i / sorted.length) * 100));
        setUploadStatus(`${shortName} (${i + 1}/${sorted.length})`);

        if (file.size <= MAX_UPLOAD_SIZE && !hasOversized) {
          // Upload to Supabase Storage
          const sf = await uploadSourceFile(row.id, file, i);
          if (sf) {
            sourceFiles.push({
              id: sf.id,
              fileName: sf.file_name,
              storagePath: sf.storage_path,
              fileSize: sf.file_size ?? undefined,
              sortOrder: sf.sort_order,
            });
          }
        } else {
          // Keep local with Object URL
          const objectUrl = URL.createObjectURL(file);
          sourceFiles.push({
            id: crypto.randomUUID(),
            fileName: file.name,
            objectUrl,
            fileSize: file.size,
            sortOrder: i,
          });
        }
      }

      setUploadProgress(100);
      setUploadStatus('');
      dispatch({ type: 'SET_SOURCE_FILES', files: sourceFiles });

      // Load the first file
      if (sourceFiles.length > 0) {
        dispatch({ type: 'SET_ACTIVE_SOURCE_FILE', id: sourceFiles[0].id });
        let url: string | null = null;
        if (sourceFiles[0].objectUrl) {
          url = sourceFiles[0].objectUrl;
        } else if (sourceFiles[0].storagePath) {
          url = await getSourceFileUrl(sourceFiles[0].storagePath);
        }
        if (url) {
          dispatch({ type: 'SET_RESOLVED_STREAM_URL', url });
          dispatch({ type: 'SET_STREAM_STATUS', status: 'loading' });
        }
      }

      setUploading(false);
    }
  }, [dispatch, activeTeam]);

  return { handleFiles, uploading, uploadProgress, uploadStatus };
}
