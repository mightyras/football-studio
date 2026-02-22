-- ============================================================
-- Team Board Visibility — allow team members to view team boards
-- ============================================================

-- Allow team members to SELECT boards shared with their team
CREATE POLICY "Team members can view team boards"
  ON public.boards FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND visibility = 'team'
    AND team_id IN (
      SELECT tm.team_id FROM public.team_members tm WHERE tm.user_id = auth.uid()
    )
  );
