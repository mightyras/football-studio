-- ============================================================
-- Match Plans — persistent storage for match management plans
-- ============================================================

CREATE TABLE public.match_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  name text NOT NULL,
  data jsonb NOT NULL,
  board_context jsonb,
  visibility public.board_visibility NOT NULL DEFAULT 'private',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX idx_match_plans_owner ON public.match_plans(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_match_plans_team ON public.match_plans(team_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_match_plans_updated ON public.match_plans(updated_at DESC) WHERE deleted_at IS NULL;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.match_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own match plans"
  ON public.match_plans FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL AND owner_id = auth.uid());

CREATE POLICY "Users can insert their own match plans"
  ON public.match_plans FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own match plans"
  ON public.match_plans FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete their own match plans"
  ON public.match_plans FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Team members can view team match plans"
  ON public.match_plans FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND visibility = 'team'
    AND team_id IN (
      SELECT tm.team_id FROM public.team_members tm WHERE tm.user_id = auth.uid()
    )
  );

-- ============================================================
-- Soft-delete RPC (bypasses SELECT policy so deleted rows can be updated)
-- ============================================================

CREATE OR REPLACE FUNCTION public.soft_delete_match_plan(p_match_plan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.match_plans
  SET deleted_at = now()
  WHERE id = p_match_plan_id AND owner_id = auth.uid();
END;
$$;
