import { supabase } from '../lib/supabase';
import type { SquadPlayer } from '../types';

/** Fetch all squad players for a team (any team member can view). */
export async function fetchSquadPlayers(teamId: string): Promise<SquadPlayer[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('team_squad_players')
    .select('id, team_id, name, jersey_number')
    .eq('team_id', teamId)
    .order('jersey_number', { ascending: true });
  if (error || !data) return [];
  return data as SquadPlayer[];
}

/** Add a squad player (admin only via RLS). */
export async function addSquadPlayer(
  teamId: string,
  name: string,
  jerseyNumber: number,
): Promise<SquadPlayer | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('team_squad_players')
    .insert({ team_id: teamId, name, jersey_number: jerseyNumber })
    .select('id, team_id, name, jersey_number')
    .single();
  if (error || !data) return null;
  return data as SquadPlayer;
}

/** Update a squad player's name and/or number (admin only via RLS). */
export async function updateSquadPlayer(
  id: string,
  updates: { name?: string; jersey_number?: number },
): Promise<boolean> {
  if (!supabase) return false;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.jersey_number !== undefined) patch.jersey_number = updates.jersey_number;
  const { error } = await supabase
    .from('team_squad_players')
    .update(patch)
    .eq('id', id);
  return !error;
}

/** Remove a squad player (admin only via RLS). */
export async function removeSquadPlayer(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('team_squad_players')
    .delete()
    .eq('id', id);
  return !error;
}
