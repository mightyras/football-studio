import { supabase } from '../lib/supabase';
import type { Team, TeamMember, TeamRole } from '../types';

/** Fetch all teams the current user belongs to, with their role. */
export async function fetchMyTeams(): Promise<
  Array<Team & { myRole: TeamRole }>
> {
  if (!supabase) return [];

  // Get team memberships with team data
  const { data, error } = await supabase
    .from('team_members')
    .select('role, teams:team_id(id, name, created_by, created_at, logo_url, primary_color, secondary_color, highlight_color, background_color, player_color, outline_color)')
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '');

  if (error || !data) return [];

  return data
    .filter((row: any) => row.teams)
    .map((row: any) => ({
      id: row.teams.id,
      name: row.teams.name,
      created_by: row.teams.created_by,
      created_at: row.teams.created_at,
      logo_url: row.teams.logo_url ?? null,
      primary_color: row.teams.primary_color ?? null,
      secondary_color: row.teams.secondary_color ?? null,
      highlight_color: row.teams.highlight_color ?? null,
      background_color: row.teams.background_color ?? null,
      player_color: row.teams.player_color ?? null,
      outline_color: row.teams.outline_color ?? null,
      myRole: row.role as TeamRole,
    }));
}

/** Fetch members of a team with their profile info. */
export async function fetchTeamMembers(
  teamId: string,
): Promise<TeamMember[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('team_members')
    .select(
      'team_id, user_id, role, joined_at, profiles:user_id(id, display_name, email, avatar_url)',
    )
    .eq('team_id', teamId)
    .order('joined_at', { ascending: true });

  if (error || !data) return [];

  return data.map((row: any) => ({
    team_id: row.team_id,
    user_id: row.user_id,
    role: row.role as TeamRole,
    joined_at: row.joined_at,
    profile: row.profiles
      ? {
          id: row.profiles.id,
          display_name: row.profiles.display_name,
          email: row.profiles.email,
          avatar_url: row.profiles.avatar_url,
        }
      : undefined,
  }));
}

/** Create a new team (current user becomes admin). Returns the new team ID. */
export async function createTeam(name: string): Promise<string | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.rpc('create_team', {
    team_name: name,
  });

  if (error) return null;
  return data as string;
}

/** Update a team's name (admin only via RLS). */
export async function updateTeam(
  teamId: string,
  name: string,
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('teams')
    .update({ name })
    .eq('id', teamId);
  return !error;
}

/** Remove a member from a team (admin only, or self-leave). */
export async function removeMember(
  teamId: string,
  userId: string,
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', userId);
  return !error;
}

/** Update a member's role (admin only via RLS). */
export async function updateMemberRole(
  teamId: string,
  userId: string,
  role: TeamRole,
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('team_members')
    .update({ role })
    .eq('team_id', teamId)
    .eq('user_id', userId);
  return !error;
}

/** Check if the current user is a super admin. */
export async function checkSuperAdmin(): Promise<boolean> {
  if (!supabase) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from('super_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  return !error && data !== null;
}

// ── Admin Dashboard Functions ──

/** Fetch all teams created by the current user (super admin view). */
export async function fetchCreatedTeams(): Promise<Team[]> {
  if (!supabase) return [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('teams')
    .select('id, name, created_by, created_at, logo_url, primary_color, secondary_color, highlight_color, background_color, player_color, outline_color')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map((t: any) => ({
    id: t.id,
    name: t.name,
    created_by: t.created_by,
    created_at: t.created_at,
    logo_url: t.logo_url ?? null,
    primary_color: t.primary_color ?? null,
    secondary_color: t.secondary_color ?? null,
    highlight_color: t.highlight_color ?? null,
    background_color: t.background_color ?? null,
    player_color: t.player_color ?? null,
    outline_color: t.outline_color ?? null,
  }));
}

/** Create a team (super admin only). Optionally invite an admin. Returns the new team ID. */
export async function createTeamForAdmin(
  name: string,
  adminEmail?: string,
  adminName?: string,
): Promise<string | null> {
  if (!supabase) return null;
  const params: Record<string, string> = { team_name: name };
  if (adminEmail) params.admin_email = adminEmail;
  const { data, error } = await supabase.rpc('create_team_for_admin', params);
  if (error) return null;
  const teamId = data as string;

  // If a name was provided, update the invite that the RPC just created
  if (adminEmail && adminName?.trim() && teamId) {
    await supabase
      .from('invites')
      .update({ invitee_name: adminName.trim() })
      .eq('team_id', teamId)
      .eq('invitee_email', adminEmail.toLowerCase().trim())
      .eq('status', 'pending');
  }

  return teamId;
}

/** Update a team's branding (logo, colors). */
export async function updateTeamBranding(
  teamId: string,
  branding: {
    logo_url?: string | null;
    primary_color?: string | null;
    secondary_color?: string | null;
    highlight_color?: string | null;
    background_color?: string | null;
    player_color?: string | null;
    outline_color?: string | null;
  },
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('teams')
    .update(branding)
    .eq('id', teamId);
  return !error;
}

/** Upload a team logo to Supabase Storage. Returns the public URL. */
export async function uploadTeamLogo(
  teamId: string,
  file: File,
): Promise<string | null> {
  if (!supabase) return null;

  const path = `${teamId}/logo`;
  const { error } = await supabase.storage
    .from('team-logos')
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) return null;

  const { data: urlData } = supabase.storage
    .from('team-logos')
    .getPublicUrl(path);

  // Add cache-bust to avoid stale logos
  const publicUrl = urlData.publicUrl + '?t=' + Date.now();

  // Also update the team record
  await updateTeamBranding(teamId, { logo_url: publicUrl });

  return publicUrl;
}

/** Delete a team's logo from storage and clear the URL. */
export async function deleteTeamLogo(teamId: string): Promise<boolean> {
  if (!supabase) return false;

  const path = `${teamId}/logo`;
  await supabase.storage.from('team-logos').remove([path]);
  return updateTeamBranding(teamId, { logo_url: null });
}

/** Delete an entire team. Cleans up logo storage first, then cascade-deletes via RPC. */
export async function deleteTeam(teamId: string): Promise<boolean> {
  if (!supabase) return false;

  // Clean up logo from storage first (before team row is gone)
  const path = `${teamId}/logo`;
  await supabase.storage.from('team-logos').remove([path]);

  // Delete team — cascade handles team_members + invites
  const { error } = await supabase.rpc('delete_team_for_admin', { target_team_id: teamId });
  return !error;
}
