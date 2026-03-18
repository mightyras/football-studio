-- ============================================================
-- Team Squad Players — roster of players for a team
-- ============================================================

create table public.team_squad_players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  jersey_number integer not null check (jersey_number >= 0 and jersey_number <= 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, jersey_number)
);

create index idx_team_squad_players_team on public.team_squad_players(team_id);

alter table public.team_squad_players enable row level security;

-- Team members can view squad players
create policy "Team members can view squad players"
  on public.team_squad_players for select
  to authenticated
  using (
    team_id in (select tm.team_id from public.team_members tm where tm.user_id = auth.uid())
    or exists (select 1 from public.super_admins where user_id = auth.uid())
  );

-- Team admins can insert squad players
create policy "Team admins can insert squad players"
  on public.team_squad_players for insert
  to authenticated
  with check (
    team_id in (
      select tm.team_id from public.team_members tm
      where tm.user_id = auth.uid() and tm.role = 'admin'
    )
    or exists (select 1 from public.super_admins where user_id = auth.uid())
  );

-- Team admins can update squad players
create policy "Team admins can update squad players"
  on public.team_squad_players for update
  to authenticated
  using (
    team_id in (
      select tm.team_id from public.team_members tm
      where tm.user_id = auth.uid() and tm.role = 'admin'
    )
    or exists (select 1 from public.super_admins where user_id = auth.uid())
  );

-- Team admins can delete squad players
create policy "Team admins can delete squad players"
  on public.team_squad_players for delete
  to authenticated
  using (
    team_id in (
      select tm.team_id from public.team_members tm
      where tm.user_id = auth.uid() and tm.role = 'admin'
    )
    or exists (select 1 from public.super_admins where user_id = auth.uid())
  );
