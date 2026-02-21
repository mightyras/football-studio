-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- TEAMS (future: org/team grouping)
-- ============================================================
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- TEAM MEMBERS (future: roles within teams)
-- ============================================================
create type public.team_role as enum ('admin', 'member');

create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.team_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

-- ============================================================
-- BOARDS (the core entity — formerly "SavedScene")
-- ============================================================
create type public.board_visibility as enum ('private', 'team', 'public');

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  name text not null,
  data jsonb not null,
  thumbnail_path text,
  visibility public.board_visibility not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_boards_owner on public.boards(owner_id) where deleted_at is null;
create index idx_boards_team on public.boards(team_id) where deleted_at is null;
create index idx_boards_updated on public.boards(updated_at desc) where deleted_at is null;

-- ============================================================
-- BOARD COLLABORATORS (future: per-board sharing)
-- ============================================================
create type public.board_permission as enum ('view', 'edit');

create table public.board_collaborators (
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission public.board_permission not null default 'view',
  invited_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

-- ============================================================
-- INVITES (future: team/board invitation system)
-- ============================================================
create type public.invite_status as enum ('pending', 'accepted', 'declined', 'expired');

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete cascade,
  board_id uuid references public.boards(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_email text not null,
  role public.team_role default 'member',
  permission public.board_permission default 'edit',
  status public.invite_status not null default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  check (team_id is not null or board_id is not null)
);

-- ============================================================
-- SUPER ADMIN (future)
-- ============================================================
create table public.super_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  granted_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.boards enable row level security;
alter table public.board_collaborators enable row level security;
alter table public.invites enable row level security;
alter table public.super_admins enable row level security;

-- PROFILES
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid());

-- BOARDS (Phase 1: owner-only access)
create policy "Users can view their own boards"
  on public.boards for select
  to authenticated
  using (deleted_at is null and owner_id = auth.uid());

create policy "Users can insert their own boards"
  on public.boards for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "Users can update their own boards"
  on public.boards for update
  to authenticated
  using (owner_id = auth.uid());

create policy "Users can delete their own boards"
  on public.boards for delete
  to authenticated
  using (owner_id = auth.uid());

-- TEAM MEMBERS
create policy "Team members can view their team membership"
  on public.team_members for select
  to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- SUPABASE STORAGE: Thumbnail bucket
-- ============================================================
insert into storage.buckets (id, name, public)
values ('thumbnails', 'thumbnails', true);

create policy "Users can upload thumbnails"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'thumbnails'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Anyone can view thumbnails"
  on storage.objects for select
  to public
  using (bucket_id = 'thumbnails');

create policy "Users can delete their own thumbnails"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'thumbnails'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
