import { supabase } from '../lib/supabase';
import type { SceneData } from '../types';

export type BoardRow = {
  id: string;
  owner_id: string;
  team_id: string | null;
  visibility: 'private' | 'team';
  owner_name: string | null;
  name: string;
  data: SceneData;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
};

const BOARD_COLUMNS = 'id, owner_id, team_id, visibility, name, data, thumbnail_path, created_at, updated_at';

function mapRow(sb: NonNullable<typeof supabase>, row: Record<string, unknown>, ownerName?: string | null): BoardRow {
  return {
    id: row.id as string,
    owner_id: row.owner_id as string,
    team_id: (row.team_id as string) ?? null,
    visibility: (row.visibility as 'private' | 'team') ?? 'private',
    owner_name: ownerName ?? null,
    name: row.name as string,
    data: row.data as SceneData,
    thumbnail_url: row.thumbnail_path
      ? sb.storage.from('thumbnails').getPublicUrl(row.thumbnail_path as string).data.publicUrl
      : null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

/** Fetch personal boards (no team) for the current user, newest first. */
export async function fetchMyBoards(): Promise<BoardRow[]> {
  const sb = supabase;
  if (!sb) return [];
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return [];

  const { data, error } = await sb
    .from('boards')
    .select(BOARD_COLUMNS)
    .is('deleted_at', null)
    .is('team_id', null)
    .order('updated_at', { ascending: false });

  if (error || !data) return [];
  return data.map(row => mapRow(sb, row));
}

/** Fetch team boards visible to the current user, newest first.
 *  Joins with profiles to get owner display_name. */
export async function fetchTeamBoards(teamId: string): Promise<BoardRow[]> {
  const sb = supabase;
  if (!sb) return [];

  const { data, error } = await sb
    .from('boards')
    .select(`${BOARD_COLUMNS}, profiles:owner_id(display_name)`)
    .is('deleted_at', null)
    .eq('team_id', teamId)
    .eq('visibility', 'team')
    .order('updated_at', { ascending: false });

  if (error || !data) return [];
  return data.map(row => {
    const profile = row.profiles as unknown as { display_name: string | null } | null;
    return mapRow(sb, row, profile?.display_name ?? null);
  });
}

/** Create a new board. Optionally assign to a team.
 *  Returns the created BoardRow. */
export async function createBoard(
  name: string,
  data: SceneData,
  thumbnailDataUrl: string | null,
  teamId?: string,
): Promise<BoardRow | null> {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Generate a UUID for the board so we can use it in the thumbnail path
  const boardId = crypto.randomUUID();

  // Upload thumbnail to Supabase Storage
  let thumbnailPath: string | null = null;
  if (thumbnailDataUrl) {
    const blob = await (await fetch(thumbnailDataUrl)).blob();
    const path = `${user.id}/${boardId}.png`;
    const { error: uploadErr } = await supabase.storage
      .from('thumbnails')
      .upload(path, blob, { contentType: 'image/png', upsert: true });
    if (!uploadErr) thumbnailPath = path;
  }

  // Insert board row
  const insertData: Record<string, unknown> = {
    id: boardId,
    owner_id: user.id,
    name,
    data: data as unknown as Record<string, unknown>,
    thumbnail_path: thumbnailPath,
  };

  if (teamId) {
    insertData.team_id = teamId;
    insertData.visibility = 'team';
  }

  const { data: row, error } = await supabase
    .from('boards')
    .insert(insertData)
    .select(BOARD_COLUMNS)
    .single();

  if (error || !row) return null;
  return mapRow(supabase, row);
}

/** Update an existing board's data and/or thumbnail. */
export async function updateBoard(
  id: string,
  updates: { name?: string; data?: SceneData; thumbnailDataUrl?: string | null },
): Promise<boolean> {
  if (!supabase) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.data !== undefined) patch.data = updates.data as unknown as Record<string, unknown>;

  // Upload new thumbnail if provided
  if (updates.thumbnailDataUrl) {
    const blob = await (await fetch(updates.thumbnailDataUrl)).blob();
    const path = `${user.id}/${id}.png`;
    const { error: uploadErr } = await supabase.storage
      .from('thumbnails')
      .upload(path, blob, { contentType: 'image/png', upsert: true });
    if (!uploadErr) patch.thumbnail_path = path;
  }

  const { error } = await supabase.from('boards').update(patch).eq('id', id);
  return !error;
}

/** Soft-delete a board (set deleted_at). */
export async function deleteBoard(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('boards')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  return !error;
}

/** Rename a board. */
export async function renameBoard(id: string, name: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('boards')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', id);
  return !error;
}
