import { supabase } from '../lib/supabase';
import { sendInviteEmail, generateInviteLink } from './sendInviteEmail';
import type { BoardCollaborator, Invite } from '../types';

/** Create a board invite. Caller must be the board owner (enforced by RLS). */
export async function createBoardInvite(
  boardId: string,
  email: string,
  permission: 'view' | 'edit' = 'edit',
  name?: string,
): Promise<Invite | null> {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const row: Record<string, unknown> = {
    board_id: boardId,
    inviter_id: user.id,
    invitee_email: email.toLowerCase().trim(),
    permission,
  };
  if (name?.trim()) row.invitee_name = name.trim();

  const { data, error } = await supabase
    .from('invites')
    .insert(row)
    .select()
    .single();

  if (error || !data) return null;

  // Send invite email (fire-and-forget — invite record is already saved)
  sendInviteEmail(email, name).catch(() => {});

  return data as Invite;
}

/** Create a board invite and return a shareable link (instead of sending email). */
export async function createBoardInviteWithLink(
  boardId: string,
  email: string,
  permission: 'view' | 'edit' = 'edit',
  name?: string,
): Promise<{ invite: Invite | null; inviteLink?: string }> {
  if (!supabase) return { invite: null };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { invite: null };

  const row: Record<string, unknown> = {
    board_id: boardId,
    inviter_id: user.id,
    invitee_email: email.toLowerCase().trim(),
    permission,
  };
  if (name?.trim()) row.invitee_name = name.trim();

  const { data, error } = await supabase
    .from('invites')
    .insert(row)
    .select()
    .single();

  if (error || !data) return { invite: null };

  // Generate invite link (creates auth user if needed)
  const result = await generateInviteLink(email, name);

  return {
    invite: data as Invite,
    inviteLink: result.inviteLink,
  };
}

/** Fetch collaborators for a board, joined with profiles. */
export async function fetchBoardCollaborators(boardId: string): Promise<BoardCollaborator[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('board_collaborators')
    .select('board_id, user_id, permission, invited_at, profiles:user_id(id, display_name, email, avatar_url)')
    .eq('board_id', boardId);

  if (error || !data) return [];

  return data.map((row: Record<string, unknown>) => {
    const profile = row.profiles as { id: string; display_name: string | null; email: string; avatar_url: string | null } | null;
    return {
      board_id: row.board_id as string,
      user_id: row.user_id as string,
      permission: row.permission as 'view' | 'edit',
      invited_at: row.invited_at as string,
      profile: profile ?? undefined,
    };
  });
}

/** Remove a collaborator from a board (board owner or self). */
export async function removeBoardCollaborator(boardId: string, userId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('board_collaborators')
    .delete()
    .eq('board_id', boardId)
    .eq('user_id', userId);
  return !error;
}

/** Fetch pending board invites for the current user. */
export async function fetchMyBoardInvites(): Promise<Invite[]> {
  if (!supabase) return [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', user.id)
    .single();

  if (!profile) return [];

  const { data, error } = await supabase
    .from('invites')
    .select('*')
    .eq('invitee_email', profile.email)
    .not('board_id', 'is', null)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as Invite[];
}

/** Accept a board invite (RPC handles atomically). */
export async function acceptBoardInvite(inviteId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.rpc('accept_board_invite', {
    invite_id: inviteId,
  });
  return !error;
}

/** Fetch boards shared with the current user (where they are a collaborator). */
export async function fetchCollaborativeBoards(): Promise<Array<{
  id: string;
  owner_id: string;
  name: string;
  data: unknown;
  thumbnail_path: string | null;
  permission: 'view' | 'edit';
  updated_at: string;
  created_at: string;
  owner_name: string | null;
}>> {
  if (!supabase) return [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // First get board IDs from board_collaborators
  const { data: collabs, error: collabErr } = await supabase
    .from('board_collaborators')
    .select('board_id, permission')
    .eq('user_id', user.id);

  if (collabErr || !collabs || collabs.length === 0) return [];

  const boardIds = collabs.map((c: { board_id: string }) => c.board_id);
  const permissionMap = new Map(collabs.map((c: { board_id: string; permission: string }) => [c.board_id, c.permission]));

  // Fetch the boards with owner profile
  const { data: boards, error: boardErr } = await supabase
    .from('boards')
    .select('id, owner_id, name, data, thumbnail_path, updated_at, created_at, profiles:owner_id(display_name)')
    .in('id', boardIds)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (boardErr || !boards) return [];

  return boards.map((row: Record<string, unknown>) => {
    const profile = row.profiles as { display_name: string | null } | null;
    return {
      id: row.id as string,
      owner_id: row.owner_id as string,
      name: row.name as string,
      data: row.data,
      thumbnail_path: row.thumbnail_path as string | null,
      permission: (permissionMap.get(row.id as string) ?? 'view') as 'view' | 'edit',
      updated_at: row.updated_at as string,
      created_at: row.created_at as string,
      owner_name: profile?.display_name ?? null,
    };
  });
}

/** Fetch pending board invites that the current user has sent for a specific board. */
export async function fetchBoardInvites(boardId: string): Promise<Invite[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('invites')
    .select('*')
    .eq('board_id', boardId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as Invite[];
}

/** Cancel a pending board invite. */
export async function cancelBoardInvite(inviteId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('invites')
    .update({ status: 'expired' as const })
    .eq('id', inviteId);
  return !error;
}
