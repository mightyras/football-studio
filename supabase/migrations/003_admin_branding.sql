-- ============================================================
-- Phase 2: Super Admin Dashboard — branding, RLS fixes, team-logos storage
-- ============================================================

-- ── ADD BRANDING COLUMNS TO TEAMS ──
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS primary_color text,
  ADD COLUMN IF NOT EXISTS secondary_color text;

-- ── FIX RLS POLICIES: Replace blanket super_admin access with created_by scoping ──

-- 1. Fix teams SELECT policy
DROP POLICY IF EXISTS "Team members can view their teams" ON public.teams;
CREATE POLICY "Team members can view their teams"
  ON public.teams FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    OR created_by = auth.uid()
  );

-- 2. Fix teams UPDATE policy
DROP POLICY IF EXISTS "Team admins can update their team" ON public.teams;
CREATE POLICY "Team admins can update their team"
  ON public.teams FOR UPDATE
  TO authenticated
  USING (
    id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid() AND role = 'admin')
    OR created_by = auth.uid()
  );

-- 3. Fix team_members SELECT policy
DROP POLICY IF EXISTS "Users can view members of their teams" ON public.team_members;
CREATE POLICY "Users can view members of their teams"
  ON public.team_members FOR SELECT
  TO authenticated
  USING (
    team_id IN (SELECT tm.team_id FROM public.team_members tm WHERE tm.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_id AND t.created_by = auth.uid()
    )
  );

-- ── INVITE POLICY: Allow super admins (team creators) to create invites for their teams ──
DROP POLICY IF EXISTS "Team admins can create invites" ON public.invites;
CREATE POLICY "Team admins or creators can create invites"
  ON public.invites FOR INSERT
  TO authenticated
  WITH CHECK (
    inviter_id = auth.uid()
    AND (
      team_id IN (SELECT tm.team_id FROM public.team_members tm WHERE tm.user_id = auth.uid() AND tm.role = 'admin')
      OR team_id IN (SELECT t.id FROM public.teams t WHERE t.created_by = auth.uid())
    )
  );

-- Also allow team creators to view team invites
CREATE POLICY "Team creators can view team invites"
  ON public.invites FOR SELECT
  TO authenticated
  USING (
    team_id IN (SELECT t.id FROM public.teams t WHERE t.created_by = auth.uid())
  );

-- Allow team creators to cancel invites for their teams
CREATE POLICY "Team creators can cancel invites"
  ON public.invites FOR UPDATE
  TO authenticated
  USING (
    team_id IN (SELECT t.id FROM public.teams t WHERE t.created_by = auth.uid())
  );

-- ── TEAM-LOGOS STORAGE BUCKET ──
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-logos', 'team-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Public read for logos
CREATE POLICY "Anyone can view team logos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'team-logos');

-- Team admins or team creators can upload logos
CREATE POLICY "Team admins or creators can upload logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'team-logos'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT tm.team_id::text FROM public.team_members tm
        WHERE tm.user_id = auth.uid() AND tm.role = 'admin'
      )
      OR (storage.foldername(name))[1] IN (
        SELECT t.id::text FROM public.teams t WHERE t.created_by = auth.uid()
      )
    )
  );

-- Team admins or team creators can update logos
CREATE POLICY "Team admins or creators can update logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'team-logos'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT tm.team_id::text FROM public.team_members tm
        WHERE tm.user_id = auth.uid() AND tm.role = 'admin'
      )
      OR (storage.foldername(name))[1] IN (
        SELECT t.id::text FROM public.teams t WHERE t.created_by = auth.uid()
      )
    )
  );

-- Team admins or team creators can delete logos
CREATE POLICY "Team admins or creators can delete logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'team-logos'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT tm.team_id::text FROM public.team_members tm
        WHERE tm.user_id = auth.uid() AND tm.role = 'admin'
      )
      OR (storage.foldername(name))[1] IN (
        SELECT t.id::text FROM public.teams t WHERE t.created_by = auth.uid()
      )
    )
  );

-- ============================================================
-- RPC: create_team_for_admin — super admin creates team + sends invite to the team admin
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_team_for_admin(
  team_name text,
  admin_email text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  new_team_id uuid;
  caller_id uuid;
  is_super boolean;
BEGIN
  caller_id := auth.uid();

  -- Verify the caller is a super admin
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins WHERE user_id = caller_id
  ) INTO is_super;

  IF NOT is_super THEN
    RAISE EXCEPTION 'Only super admins can use this function';
  END IF;

  -- Create the team
  INSERT INTO public.teams (name, created_by)
  VALUES (team_name, caller_id)
  RETURNING id INTO new_team_id;

  -- Create a pending invite for the admin
  INSERT INTO public.invites (team_id, inviter_id, invitee_email, role, status, expires_at)
  VALUES (
    new_team_id,
    caller_id,
    admin_email,
    'admin',
    'pending',
    now() + interval '30 days'
  );

  RETURN new_team_id;
END;
$$;

-- ============================================================
-- RPC: toggle_super_admin_membership — super admin joins/leaves a team they created
-- ============================================================
CREATE OR REPLACE FUNCTION public.toggle_super_admin_membership(target_team_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  caller_id uuid;
  is_creator boolean;
  is_member boolean;
BEGIN
  caller_id := auth.uid();

  -- Verify the caller created this team
  SELECT EXISTS (
    SELECT 1 FROM public.teams WHERE id = target_team_id AND created_by = caller_id
  ) INTO is_creator;

  IF NOT is_creator THEN
    RAISE EXCEPTION 'You can only toggle membership for teams you created';
  END IF;

  -- Check current membership
  SELECT EXISTS (
    SELECT 1 FROM public.team_members WHERE team_id = target_team_id AND user_id = caller_id
  ) INTO is_member;

  IF is_member THEN
    -- Leave the team
    DELETE FROM public.team_members
    WHERE team_id = target_team_id AND user_id = caller_id;
    RETURN false; -- now NOT a member
  ELSE
    -- Join the team as member
    INSERT INTO public.team_members (team_id, user_id, role)
    VALUES (target_team_id, caller_id, 'member');
    RETURN true; -- now a member
  END IF;
END;
$$;
