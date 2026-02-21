import { supabase } from '../lib/supabase';
import type { SceneData } from '../types';

export type BoardRow = {
  id: string;
  owner_id: string;
  name: string;
  data: SceneData;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
};

/** Fetch all boards for the current user, newest first. */
export async function fetchBoards(): Promise<BoardRow[]> {
  const sb = supabase;
  if (!sb) return [];
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return [];

  const { data, error } = await sb
    .from('boards')
    .select('id, owner_id, name, data, thumbnail_path, created_at, updated_at')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (error || !data) return [];

  return data.map(row => ({
    id: row.id,
    owner_id: row.owner_id,
    name: row.name,
    data: row.data as SceneData,
    thumbnail_url: row.thumbnail_path
      ? sb.storage.from('thumbnails').getPublicUrl(row.thumbnail_path).data.publicUrl
      : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

/** Create a new board. Returns the created BoardRow. */
export async function createBoard(
  name: string,
  data: SceneData,
  thumbnailDataUrl: string | null,
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
  const { data: row, error } = await supabase
    .from('boards')
    .insert({
      id: boardId,
      owner_id: user.id,
      name,
      data: data as unknown as Record<string, unknown>,
      thumbnail_path: thumbnailPath,
    })
    .select('id, owner_id, name, data, thumbnail_path, created_at, updated_at')
    .single();

  if (error || !row) return null;

  return {
    id: row.id,
    owner_id: row.owner_id,
    name: row.name,
    data: row.data as SceneData,
    thumbnail_url: row.thumbnail_path
      ? supabase.storage.from('thumbnails').getPublicUrl(row.thumbnail_path).data.publicUrl
      : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
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
