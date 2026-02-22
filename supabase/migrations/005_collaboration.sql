-- ============================================================
-- Collaboration: RLS for board_collaborators, board invite RPC,
-- boards SELECT for collaborators, Realtime publication
-- ============================================================

-- ── Helper functions (SECURITY DEFINER to bypass RLS and avoid
--    infinite recursion between boards ↔ board_collaborators) ──

CREATE OR REPLACE FUNCTION public.is_board_owner(p_board_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.boards
    WHERE id = p_board_id AND owner_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_board_collaborator(p_board_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.board_collaborators
    WHERE board_id = p_board_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.get_board_permission(p_board_id uuid, p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = ''
AS $$
  SELECT permission::text FROM public.board_collaborators
  WHERE board_id = p_board_id AND user_id = p_user_id
  LIMIT 1;
$$;

-- ── BOARD COLLABORATORS RLS ──

-- Collaborators can see their own rows
CREATE POLICY "Collaborators can view their board access"
  ON public.board_collaborators FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Board owners can see all collaborators on their boards
CREATE POLICY "Board owners can view collaborators"
  ON public.board_collaborators FOR SELECT
  TO authenticated
  USING (
    public.is_board_owner(board_id, auth.uid())
  );

-- Board owners can add collaborators
CREATE POLICY "Board owners can add collaborators"
  ON public.board_collaborators FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_board_owner(board_id, auth.uid())
  );

-- Board owners can remove collaborators
CREATE POLICY "Board owners can remove collaborators"
  ON public.board_collaborators FOR DELETE
  TO authenticated
  USING (
    public.is_board_owner(board_id, auth.uid())
  );

-- Collaborators can remove themselves
CREATE POLICY "Collaborators can leave boards"
  ON public.board_collaborators FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ── BOARDS: allow collaborators to view shared boards ──

CREATE POLICY "Collaborators can view shared boards"
  ON public.boards FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND public.is_board_collaborator(id, auth.uid())
  );

-- Collaborators with 'edit' permission can update boards
CREATE POLICY "Edit collaborators can update boards"
  ON public.boards FOR UPDATE
  TO authenticated
  USING (
    public.get_board_permission(id, auth.uid()) = 'edit'
  );

-- ── INVITES: allow board owners to create board invites ──

CREATE POLICY "Board owners can create board invites"
  ON public.invites FOR INSERT
  TO authenticated
  WITH CHECK (
    inviter_id = auth.uid()
    AND board_id IS NOT NULL
    AND public.is_board_owner(board_id, auth.uid())
  );

-- ============================================================
-- RPC: accept_board_invite — atomically accepts invite + adds collaborator
-- ============================================================
CREATE OR REPLACE FUNCTION public.accept_board_invite(invite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  inv record;
  caller_email text;
BEGIN
  -- Get the caller's email
  SELECT email INTO caller_email
  FROM public.profiles
  WHERE id = auth.uid();

  -- Fetch the invite and verify it belongs to this user
  SELECT * INTO inv
  FROM public.invites
  WHERE id = invite_id
    AND invitee_email = caller_email
    AND status = 'pending'
    AND board_id IS NOT NULL
    AND expires_at > now();

  IF inv IS NULL THEN
    RAISE EXCEPTION 'Board invite not found, expired, or not for this user';
  END IF;

  -- Update invite status
  UPDATE public.invites
  SET status = 'accepted'
  WHERE id = invite_id;

  -- Add as board collaborator
  INSERT INTO public.board_collaborators (board_id, user_id, permission)
  VALUES (inv.board_id, auth.uid(), COALESCE(inv.permission, 'view'))
  ON CONFLICT (board_id, user_id) DO UPDATE
  SET permission = EXCLUDED.permission;
END;
$$;

-- ============================================================
-- Enable Realtime for boards table (for Presence channel)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.boards;
