import { supabase } from '../../lib/supabase';
import type { UrlMetadata, Bookmark, VideoAnnotation } from '../types';

// ============================================================
// Row types
// ============================================================

export type AnalysisSessionRow = {
  id: string;
  owner_id: string;
  team_id: string | null;
  name: string;
  stream_url: string;
  metadata: UrlMetadata | null;
  bookmarks: Bookmark[];
  visibility: 'private' | 'team';
  clip_count: number;
  created_at: string;
  updated_at: string;
};

export type AnalysisClipRow = {
  id: string;
  session_id: string;
  owner_id: string;
  type: 'screenshot' | 'video';
  label: string | null;
  timestamp: number;
  in_point: number | null;
  out_point: number | null;
  storage_path: string;
  thumbnail_path: string | null;
  annotations: VideoAnnotation[];
  created_at: string;
};

// ============================================================
// Helpers
// ============================================================

const SESSION_COLUMNS = 'id, owner_id, team_id, name, stream_url, metadata, bookmarks, visibility, created_at, updated_at';

function mapSessionRow(row: Record<string, unknown>): AnalysisSessionRow {
  return {
    id: row.id as string,
    owner_id: row.owner_id as string,
    team_id: (row.team_id as string) ?? null,
    name: row.name as string,
    stream_url: row.stream_url as string,
    metadata: (row.metadata as UrlMetadata) ?? null,
    bookmarks: (row.bookmarks as Bookmark[]) ?? [],
    visibility: (row.visibility as 'private' | 'team') ?? 'private',
    clip_count: 0, // populated separately when needed
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

const CLIP_COLUMNS = 'id, session_id, owner_id, type, label, timestamp, in_point, out_point, storage_path, thumbnail_path, annotations, created_at';

function mapClipRow(row: Record<string, unknown>): AnalysisClipRow {
  return {
    id: row.id as string,
    session_id: row.session_id as string,
    owner_id: row.owner_id as string,
    type: row.type as 'screenshot' | 'video',
    label: (row.label as string) ?? null,
    timestamp: row.timestamp as number,
    in_point: (row.in_point as number) ?? null,
    out_point: (row.out_point as number) ?? null,
    storage_path: row.storage_path as string,
    thumbnail_path: (row.thumbnail_path as string) ?? null,
    annotations: (row.annotations as VideoAnnotation[]) ?? [],
    created_at: row.created_at as string,
  };
}

// ============================================================
// SESSION CRUD
// ============================================================

/** Fetch the current user's own analysis sessions, newest first. */
export async function fetchMySessions(): Promise<AnalysisSessionRow[]> {
  const sb = supabase;
  if (!sb) return [];
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return [];

  const { data, error } = await sb
    .from('analysis_sessions')
    .select(SESSION_COLUMNS)
    .is('deleted_at', null)
    .eq('owner_id', user.id)
    .order('updated_at', { ascending: false });

  if (error || !data) return [];

  const sessions = data.map(row => mapSessionRow(row));

  // Batch-fetch clip counts
  if (sessions.length > 0) {
    const sessionIds = sessions.map(s => s.id);
    const { data: counts } = await sb
      .from('analysis_clips')
      .select('session_id')
      .is('deleted_at', null)
      .in('session_id', sessionIds);

    if (counts) {
      const countMap = new Map<string, number>();
      for (const row of counts) {
        const sid = row.session_id as string;
        countMap.set(sid, (countMap.get(sid) ?? 0) + 1);
      }
      for (const session of sessions) {
        session.clip_count = countMap.get(session.id) ?? 0;
      }
    }
  }

  return sessions;
}

/** Fetch team analysis sessions (visibility='team'), newest first. */
export async function fetchTeamSessions(teamId: string): Promise<AnalysisSessionRow[]> {
  const sb = supabase;
  if (!sb) return [];

  const { data, error } = await sb
    .from('analysis_sessions')
    .select(SESSION_COLUMNS)
    .is('deleted_at', null)
    .eq('team_id', teamId)
    .eq('visibility', 'team')
    .order('updated_at', { ascending: false });

  if (error || !data) return [];
  return data.map(row => mapSessionRow(row));
}

/** Create a new analysis session. */
export async function createSession(
  name: string,
  streamUrl: string,
  metadata: UrlMetadata | null,
  teamId?: string,
): Promise<AnalysisSessionRow | null> {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const id = crypto.randomUUID();

  const insertData: Record<string, unknown> = {
    id,
    owner_id: user.id,
    name,
    stream_url: streamUrl,
    metadata: metadata as unknown as Record<string, unknown>,
    bookmarks: [],
  };

  if (teamId) {
    insertData.team_id = teamId;
    insertData.visibility = 'team';
  }

  const { data: row, error } = await supabase
    .from('analysis_sessions')
    .insert(insertData)
    .select(SESSION_COLUMNS)
    .single();

  if (error || !row) return null;
  return mapSessionRow(row);
}

/** Update an existing session (bookmarks, name, metadata, streamUrl). */
export async function updateSession(
  id: string,
  updates: { name?: string; bookmarks?: Bookmark[]; metadata?: UrlMetadata | null; streamUrl?: string },
): Promise<boolean> {
  if (!supabase) return false;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.bookmarks !== undefined) patch.bookmarks = updates.bookmarks;
  if (updates.metadata !== undefined) patch.metadata = updates.metadata as unknown as Record<string, unknown>;
  if (updates.streamUrl !== undefined) patch.stream_url = updates.streamUrl;

  const { error } = await supabase.from('analysis_sessions').update(patch).eq('id', id);
  return !error;
}

/** Soft-delete a session. */
export async function deleteSession(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.rpc('soft_delete_analysis_session', { p_session_id: id });
  return !error;
}

// ============================================================
// CLIP CRUD
// ============================================================

/** Fetch all clips for a session, ordered by timestamp. */
export async function fetchSessionClips(sessionId: string): Promise<AnalysisClipRow[]> {
  const sb = supabase;
  if (!sb) return [];

  const { data, error } = await sb
    .from('analysis_clips')
    .select(CLIP_COLUMNS)
    .is('deleted_at', null)
    .eq('session_id', sessionId)
    .order('timestamp', { ascending: true });

  if (error || !data) return [];
  return data.map(row => mapClipRow(row));
}

/** Save a clip: upload blob to storage, insert DB row. */
export async function saveClip(
  sessionId: string,
  clip: {
    type: 'screenshot' | 'video';
    blob: Blob;
    thumbnailBlob?: Blob | null;
    label: string;
    timestamp: number;
    inPoint?: number;
    outPoint?: number;
    annotations: VideoAnnotation[];
  },
): Promise<AnalysisClipRow | null> {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const clipId = crypto.randomUUID();
  const ext = clip.type === 'video' ? 'webm' : 'png';
  const storagePath = `${user.id}/${clipId}.${ext}`;

  // Upload main media file
  const { error: uploadErr } = await supabase.storage
    .from('analysis-media')
    .upload(storagePath, clip.blob, {
      contentType: clip.type === 'video' ? 'video/webm' : 'image/png',
      upsert: false,
    });

  if (uploadErr) {
    console.error('Failed to upload clip media:', uploadErr);
    return null;
  }

  // Upload thumbnail if provided
  let thumbnailPath: string | null = null;
  if (clip.thumbnailBlob) {
    const thumbPath = `${user.id}/${clipId}_thumb.jpg`;
    const { error: thumbErr } = await supabase.storage
      .from('analysis-media')
      .upload(thumbPath, clip.thumbnailBlob, {
        contentType: 'image/jpeg',
        upsert: false,
      });
    if (!thumbErr) thumbnailPath = thumbPath;
  }

  // Insert DB row
  const insertData: Record<string, unknown> = {
    id: clipId,
    session_id: sessionId,
    owner_id: user.id,
    type: clip.type,
    label: clip.label,
    timestamp: clip.timestamp,
    in_point: clip.inPoint ?? null,
    out_point: clip.outPoint ?? null,
    storage_path: storagePath,
    thumbnail_path: thumbnailPath,
    annotations: clip.annotations,
  };

  const { data: row, error } = await supabase
    .from('analysis_clips')
    .insert(insertData)
    .select(CLIP_COLUMNS)
    .single();

  if (error || !row) {
    console.error('Failed to insert clip row:', error);
    return null;
  }

  return mapClipRow(row);
}

/** Update a clip's label. */
export async function updateClipLabel(id: string, label: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('analysis_clips')
    .update({ label })
    .eq('id', id);
  return !error;
}

/** Soft-delete a clip. */
export async function deleteClip(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.rpc('soft_delete_analysis_clip', { p_clip_id: id });
  return !error;
}

/** Get a signed download URL for a storage path (60-minute expiry). */
export async function getClipDownloadUrl(storagePath: string): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.storage
    .from('analysis-media')
    .createSignedUrl(storagePath, 3600); // 60 minutes

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Get a signed thumbnail URL for a storage path (60-minute expiry). */
export async function getClipThumbnailUrl(thumbnailPath: string): Promise<string | null> {
  return getClipDownloadUrl(thumbnailPath);
}
