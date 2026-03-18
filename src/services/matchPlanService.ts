import { supabase } from '../lib/supabase';
import type { MatchPlan } from '../types/matchManagement';

export type MatchPlanBoardContext = {
  teamAName: string;
  teamBName: string;
  teamAColor: string;
  teamBColor: string;
  formationName: string | null;
  eventCount: number;
  ruleMode: string;
};

export type MatchPlanRow = {
  id: string;
  owner_id: string;
  team_id: string | null;
  visibility: 'private' | 'team';
  owner_name: string | null;
  name: string;
  data: MatchPlan;
  board_context: MatchPlanBoardContext | null;
  created_at: string;
  updated_at: string;
};

const COLUMNS = 'id, owner_id, team_id, visibility, name, data, board_context, created_at, updated_at';

function mapRow(row: Record<string, unknown>, ownerName?: string | null): MatchPlanRow {
  return {
    id: row.id as string,
    owner_id: row.owner_id as string,
    team_id: (row.team_id as string) ?? null,
    visibility: (row.visibility as 'private' | 'team') ?? 'private',
    owner_name: ownerName ?? null,
    name: row.name as string,
    data: row.data as MatchPlan,
    board_context: (row.board_context as MatchPlanBoardContext) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

/** Fetch personal match plans (no team) for the current user, newest first. */
export async function fetchMyMatchPlans(): Promise<MatchPlanRow[]> {
  const sb = supabase;
  if (!sb) return [];
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return [];

  const { data, error } = await sb
    .from('match_plans')
    .select(COLUMNS)
    .is('deleted_at', null)
    .is('team_id', null)
    .order('updated_at', { ascending: false });

  if (error || !data) return [];
  return data.map(row => mapRow(row));
}

/** Fetch team match plans visible to the current user, newest first. */
export async function fetchTeamMatchPlans(teamId: string): Promise<MatchPlanRow[]> {
  const sb = supabase;
  if (!sb) return [];

  const { data, error } = await sb
    .from('match_plans')
    .select(`${COLUMNS}, profiles:owner_id(display_name)`)
    .is('deleted_at', null)
    .eq('team_id', teamId)
    .eq('visibility', 'team')
    .order('updated_at', { ascending: false });

  if (error || !data) return [];
  return data.map(row => {
    const profile = row.profiles as unknown as { display_name: string | null } | null;
    return mapRow(row, profile?.display_name ?? null);
  });
}

/** Create a new match plan. Optionally assign to a team. */
export async function createMatchPlan(
  name: string,
  data: MatchPlan,
  boardContext: MatchPlanBoardContext | null,
  teamId?: string,
): Promise<MatchPlanRow | null> {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const id = crypto.randomUUID();

  const insertData: Record<string, unknown> = {
    id,
    owner_id: user.id,
    name,
    data: data as unknown as Record<string, unknown>,
    board_context: boardContext as unknown as Record<string, unknown>,
  };

  if (teamId) {
    insertData.team_id = teamId;
    insertData.visibility = 'team';
  }

  const { data: row, error } = await supabase
    .from('match_plans')
    .insert(insertData)
    .select(COLUMNS)
    .single();

  if (error || !row) return null;
  return mapRow(row);
}

/** Update an existing match plan's data and/or metadata. */
export async function updateMatchPlan(
  id: string,
  updates: { name?: string; data?: MatchPlan; boardContext?: MatchPlanBoardContext | null },
): Promise<boolean> {
  if (!supabase) return false;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.data !== undefined) patch.data = updates.data as unknown as Record<string, unknown>;
  if (updates.boardContext !== undefined) patch.board_context = updates.boardContext as unknown as Record<string, unknown>;

  const { error } = await supabase.from('match_plans').update(patch).eq('id', id);
  return !error;
}

/** Rename a match plan. */
export async function renameMatchPlan(id: string, name: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('match_plans')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', id);
  return !error;
}

/** Soft-delete a match plan via RPC. */
export async function deleteMatchPlan(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.rpc('soft_delete_match_plan', { p_match_plan_id: id });
  return !error;
}
