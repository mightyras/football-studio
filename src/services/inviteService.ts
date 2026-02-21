import { supabase } from '../lib/supabase';
import type { Invite, TeamRole } from '../types';

/** Create a team invite. Caller must be a team admin (enforced by RLS). */
export async function createTeamInvite(
  teamId: string,
  email: string,
  role: TeamRole = 'member',
  name?: string,
): Promise<Invite | null> {
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const row: Record<string, unknown> = {
    team_id: teamId,
    inviter_id: user.id,
    invitee_email: email.toLowerCase().trim(),
    role,
  };
  if (name?.trim()) row.invitee_name = name.trim();

  const { data, error } = await supabase
    .from('invites')
    .insert(row)
    .select()
    .single();

  if (error || !data) return null;
  return data as Invite;
}

/** Fetch pending invites for a team (admin only via RLS). */
export async function fetchTeamInvites(teamId: string): Promise<Invite[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('invites')
    .select('*')
    .eq('team_id', teamId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as Invite[];
}

/** Fetch invites sent to the current user's email. */
export async function fetchMyInvites(): Promise<Invite[]> {
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Get the user's email from their profile
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
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as Invite[];
}

/** Accept an invite (RPC handles atomically). */
export async function acceptInvite(inviteId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.rpc('accept_team_invite', {
    invite_id: inviteId,
  });
  return !error;
}

/** Decline an invite (RPC). */
export async function declineInvite(inviteId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.rpc('decline_invite', {
    invite_id: inviteId,
  });
  return !error;
}

/** Cancel a pending invite (inviter only via RLS). */
export async function cancelInvite(inviteId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('invites')
    .update({ status: 'expired' as const })
    .eq('id', inviteId);
  return !error;
}
