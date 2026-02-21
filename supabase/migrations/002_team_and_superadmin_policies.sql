-- ============================================================
-- Phase 1: Team management, invites, and super admin RLS policies
-- ============================================================

-- ── SUPER ADMINS ──
create policy "Super admins can view their own record"
  on public.super_admins for select
  to authenticated
  using (user_id = auth.uid());

-- ── TEAMS ──
create policy "Team members can view their teams"
  on public.teams for select
  to authenticated
  using (
    id in (select team_id from public.team_members where user_id = auth.uid())
    or exists (select 1 from public.super_admins where user_id = auth.uid())
  );

create policy "Authenticated users can create teams"
  on public.teams for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "Team admins can update their team"
  on public.teams for update
  to authenticated
  using (
    id in (select team_id from public.team_members where user_id = auth.uid() and role = 'admin')
    or exists (select 1 from public.super_admins where user_id = auth.uid())
  );

-- ── TEAM MEMBERS ──
-- Drop the Phase 1 policy that only allows viewing own membership
drop policy if exists "Team members can view their team membership" on public.team_members;

create policy "Users can view members of their teams"
  on public.team_members for select
  to authenticated
  using (
    team_id in (select tm.team_id from public.team_members tm where tm.user_id = auth.uid())
    or exists (select 1 from public.super_admins where user_id = auth.uid())
  );

create policy "Team admins can add members"
  on public.team_members for insert
  to authenticated
  with check (
    team_id in (select tm.team_id from public.team_members tm where tm.user_id = auth.uid() and tm.role = 'admin')
    or (user_id = auth.uid() and role = 'admin') -- creator adding themselves
  );

create policy "Team admins can update member roles"
  on public.team_members for update
  to authenticated
  using (
    team_id in (select tm.team_id from public.team_members tm where tm.user_id = auth.uid() and tm.role = 'admin')
  );

create policy "Team admins or self can remove members"
  on public.team_members for delete
  to authenticated
  using (
    team_id in (select tm.team_id from public.team_members tm where tm.user_id = auth.uid() and tm.role = 'admin')
    or user_id = auth.uid() -- users can leave teams
  );

-- ── INVITES ──
create policy "Inviters can view their own invites"
  on public.invites for select
  to authenticated
  using (inviter_id = auth.uid());

create policy "Team admins can view team invites"
  on public.invites for select
  to authenticated
  using (
    team_id in (select tm.team_id from public.team_members tm where tm.user_id = auth.uid() and tm.role = 'admin')
  );

create policy "Invitees can view invites sent to them"
  on public.invites for select
  to authenticated
  using (
    invitee_email = (select email from public.profiles where id = auth.uid())
  );

create policy "Team admins can create invites"
  on public.invites for insert
  to authenticated
  with check (
    inviter_id = auth.uid()
    and (
      team_id in (select tm.team_id from public.team_members tm where tm.user_id = auth.uid() and tm.role = 'admin')
    )
  );

create policy "Inviters can cancel their invites"
  on public.invites for update
  to authenticated
  using (inviter_id = auth.uid());

create policy "Invitees can respond to their invites"
  on public.invites for update
  to authenticated
  using (
    invitee_email = (select email from public.profiles where id = auth.uid())
  );

-- ============================================================
-- RPC: create_team — atomically creates team + adds creator as admin
-- ============================================================
create or replace function public.create_team(team_name text)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  new_team_id uuid;
begin
  insert into public.teams (name, created_by)
  values (team_name, auth.uid())
  returning id into new_team_id;

  insert into public.team_members (team_id, user_id, role)
  values (new_team_id, auth.uid(), 'admin');

  return new_team_id;
end;
$$;

-- ============================================================
-- RPC: accept_team_invite — atomically accepts invite + creates membership
-- ============================================================
create or replace function public.accept_team_invite(invite_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  inv record;
  caller_email text;
begin
  -- Get the caller's email
  select email into caller_email
  from public.profiles
  where id = auth.uid();

  -- Fetch the invite and verify it belongs to this user
  select * into inv
  from public.invites
  where id = invite_id
    and invitee_email = caller_email
    and status = 'pending'
    and expires_at > now();

  if inv is null then
    raise exception 'Invite not found, expired, or not for this user';
  end if;

  -- Update invite status
  update public.invites
  set status = 'accepted'
  where id = invite_id;

  -- Add as team member (if team invite)
  if inv.team_id is not null then
    insert into public.team_members (team_id, user_id, role)
    values (inv.team_id, auth.uid(), coalesce(inv.role, 'member'))
    on conflict (team_id, user_id) do nothing;
  end if;
end;
$$;

-- ============================================================
-- RPC: decline_invite
-- ============================================================
create or replace function public.decline_invite(invite_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  caller_email text;
begin
  select email into caller_email
  from public.profiles
  where id = auth.uid();

  update public.invites
  set status = 'declined'
  where id = invite_id
    and invitee_email = caller_email
    and status = 'pending';
end;
$$;
