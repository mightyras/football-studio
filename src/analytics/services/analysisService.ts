import { supabase } from '../../lib/supabase';
import type { UrlMetadata, VideoAnnotation } from '../types';

// ============================================================
// Row types
// ============================================================

export type AnalysisSessionRow = {
  id: string;
  owner_id: string;
  owner_display_name: string | null;
  team_id: string | null;
  name: string;
  stream_url: string;
  metadata: UrlMetadata | null;
  visibility: 'private' | 'team';
  clip_count: number;
  event_count: number;
  created_at: string;
  updated_at: string;
};

export type AnalysisClipRow = {
  id: string;
  session_id: string;
  owner_id: string;
  owner_display_name: string | null;
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

export type AnalysisEventRow = {
  id: string;
  session_id: string;
  owner_id: string;
  owner_display_name: string | null;
  time: number;
  comment: string;
  category: string | null;
  created_at: string;
};

// ============================================================
// Helpers
// ============================================================

const SESSION_COLUMNS = 'id, owner_id, team_id, name, stream_url, metadata, visibility, created_at, updated_at, profiles!owner_id(display_name)';

function mapSessionRow(row: Record<string, unknown>): AnalysisSessionRow {
  const profiles = row.profiles as { display_name: string | null } | null;
  return {
    id: row.id as string,
    owner_id: row.owner_id as string,
    owner_display_name: profiles?.display_name ?? null,
    team_id: (row.team_id as string) ?? null,
    name: row.name as string,
    stream_url: row.stream_url as string,
    metadata: (row.metadata as UrlMetadata) ?? null,
    visibility: (row.visibility as 'private' | 'team') ?? 'private',
    clip_count: 0, // populated separately when needed
    event_count: 0, // populated separately when needed
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

const CLIP_COLUMNS = 'id, session_id, owner_id, type, label, timestamp, in_point, out_point, storage_path, thumbnail_path, annotations, created_at, profiles!owner_id(display_name)';

function mapClipRow(row: Record<string, unknown>): AnalysisClipRow {
  const profiles = row.profiles as { display_name: string | null } | null;
  return {
    id: row.id as string,
    session_id: row.session_id as string,
    owner_id: row.owner_id as string,
    owner_display_name: profiles?.display_name ?? null,
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

const EVENT_COLUMNS = 'id, session_id, owner_id, time, comment, category, created_at, profiles!owner_id(display_name)';

function mapEventRow(row: Record<string, unknown>): AnalysisEventRow {
  const profiles = row.profiles as { display_name: string | null } | null;
  return {
    id: row.id as string,
    session_id: row.session_id as string,
    owner_id: row.owner_id as string,
    owner_display_name: profiles?.display_name ?? null,
    time: row.time as number,
    comment: (row.comment as string) ?? '',
    category: (row.category as string) ?? null,
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

  // Batch-fetch clip counts and event counts
  if (sessions.length > 0) {
    const sessionIds = sessions.map(s => s.id);
    await populateSessionCounts(sb, sessions, sessionIds);
  }

  return sessions;
}

/** Fetch all sessions visible to the user: own sessions + team-visible sessions. Deduped and sorted newest first. */
export async function fetchAllVisibleSessions(teamId?: string): Promise<AnalysisSessionRow[]> {
  const sb = supabase;
  if (!sb) return [];
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return [];

  // Fetch own sessions + team sessions in parallel
  const queries: Promise<AnalysisSessionRow[]>[] = [fetchMySessions()];
  if (teamId) queries.push(fetchTeamSessions(teamId));

  const results = await Promise.all(queries);
  const all = results.flat();

  // Deduplicate by id (own team-visible sessions appear in both)
  const seen = new Set<string>();
  const deduped: AnalysisSessionRow[] = [];
  for (const s of all) {
    if (!seen.has(s.id)) {
      seen.add(s.id);
      deduped.push(s);
    }
  }

  // Sort newest first
  deduped.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  return deduped;
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
  const sessions = data.map(row => mapSessionRow(row));

  // Batch-fetch clip counts and event counts
  if (sessions.length > 0) {
    const sessionIds = sessions.map(s => s.id);
    await populateSessionCounts(sb, sessions, sessionIds);
  }

  return sessions;
}

/** Populate clip_count and event_count on sessions in-place. */
async function populateSessionCounts(
  sb: NonNullable<typeof supabase>,
  sessions: AnalysisSessionRow[],
  sessionIds: string[],
) {
  const [{ data: clipCounts }, { data: eventCounts }] = await Promise.all([
    sb.from('analysis_clips').select('session_id').is('deleted_at', null).in('session_id', sessionIds),
    sb.from('analysis_events').select('session_id').is('deleted_at', null).in('session_id', sessionIds),
  ]);

  if (clipCounts) {
    const map = new Map<string, number>();
    for (const row of clipCounts) {
      const sid = row.session_id as string;
      map.set(sid, (map.get(sid) ?? 0) + 1);
    }
    for (const s of sessions) s.clip_count = map.get(s.id) ?? 0;
  }

  if (eventCounts) {
    const map = new Map<string, number>();
    for (const row of eventCounts) {
      const sid = row.session_id as string;
      map.set(sid, (map.get(sid) ?? 0) + 1);
    }
    for (const s of sessions) s.event_count = map.get(s.id) ?? 0;
  }
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

/** Update an existing session (name, metadata, streamUrl). */
export async function updateSession(
  id: string,
  updates: { name?: string; metadata?: UrlMetadata | null; streamUrl?: string },
): Promise<boolean> {
  if (!supabase) return false;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) patch.name = updates.name;
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
    mimeType?: string;
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
  const contentType = clip.mimeType ?? (clip.type === 'video' ? 'video/webm' : 'image/png');
  const ext = contentType === 'video/mp4' ? 'mp4' : clip.type === 'video' ? 'webm' : 'png';
  const storagePath = `${user.id}/${clipId}.${ext}`;

  // Upload main media file
  const { error: uploadErr } = await supabase.storage
    .from('analysis-media')
    .upload(storagePath, clip.blob, {
      contentType,
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

/** Update a clip's annotations. */
export async function updateClipAnnotations(id: string, annotations: VideoAnnotation[]): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('analysis_clips')
    .update({ annotations })
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

// ============================================================
// EVENT CRUD (analysis_events table)
// ============================================================

/** Fetch all events for a session, ordered by time. */
export async function fetchSessionEvents(sessionId: string): Promise<AnalysisEventRow[]> {
  const sb = supabase;
  if (!sb) return [];

  const { data, error } = await sb
    .from('analysis_events')
    .select(EVENT_COLUMNS)
    .is('deleted_at', null)
    .eq('session_id', sessionId)
    .order('time', { ascending: true });

  if (error || !data) return [];
  return data.map(row => mapEventRow(row));
}

/** Create an event. For category events, soft-deletes the existing one first. */
export async function createEvent(
  sessionId: string,
  event: { time: number; comment: string; category?: string | null },
): Promise<AnalysisEventRow | null> {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // For unique category events (not goals), soft-delete the existing one to enforce uniqueness
  const UNIQUE_CATEGORIES = ['kickoff', 'halftime', 'start_2nd_half', 'end'];
  if (event.category && UNIQUE_CATEGORIES.includes(event.category)) {
    const { data: existing } = await supabase
      .from('analysis_events')
      .select('id')
      .eq('session_id', sessionId)
      .eq('category', event.category)
      .is('deleted_at', null)
      .maybeSingle();

    if (existing) {
      await supabase.rpc('soft_delete_analysis_event', { p_event_id: existing.id });
    }
  }

  const id = crypto.randomUUID();
  const { data: row, error } = await supabase
    .from('analysis_events')
    .insert({
      id,
      session_id: sessionId,
      owner_id: user.id,
      time: event.time,
      comment: event.comment,
      category: event.category ?? null,
    })
    .select(EVENT_COLUMNS)
    .single();

  if (error || !row) {
    console.error('Failed to insert event:', error);
    return null;
  }

  return mapEventRow(row);
}

/** Update an event's comment. */
export async function updateEventComment(id: string, comment: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('analysis_events')
    .update({ comment })
    .eq('id', id);
  return !error;
}

/** Soft-delete an event. */
export async function deleteEvent(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.rpc('soft_delete_analysis_event', { p_event_id: id });
  return !error;
}
