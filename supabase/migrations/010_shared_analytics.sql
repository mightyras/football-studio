-- ============================================================
-- Shared Analytics — team-collaborative sessions, events table,
-- creator attribution, and updated RLS policies
-- ============================================================

-- ============================================================
-- 1. ANALYSIS EVENTS (formerly bookmarks stored as JSONB)
-- ============================================================

CREATE TABLE public.analysis_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES public.analysis_sessions(id) ON DELETE CASCADE,
  owner_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  time          float8 NOT NULL,
  comment       text NOT NULL DEFAULT '',
  category      text CHECK (category IS NULL OR category IN ('kickoff', 'halftime', 'start_2nd_half', 'end')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

CREATE INDEX idx_analysis_events_session ON public.analysis_events(session_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_analysis_events_owner ON public.analysis_events(owner_id) WHERE deleted_at IS NULL;

-- Only one of each standard category per session (soft-delete aware)
CREATE UNIQUE INDEX idx_analysis_events_unique_category
  ON public.analysis_events(session_id, category)
  WHERE category IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE public.analysis_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own events
CREATE POLICY "Users can view their own analysis events"
  ON public.analysis_events FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL AND owner_id = auth.uid());

-- Team members can view events in team-visible sessions
CREATE POLICY "Team members can view team analysis events"
  ON public.analysis_events FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND session_id IN (
      SELECT s.id FROM public.analysis_sessions s
      WHERE s.deleted_at IS NULL
        AND s.visibility = 'team'
        AND s.team_id IN (
          SELECT tm.team_id FROM public.team_members tm WHERE tm.user_id = auth.uid()
        )
    )
  );

-- Users can insert events in their own sessions
CREATE POLICY "Users can insert own session events"
  ON public.analysis_events FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND session_id IN (
      SELECT s.id FROM public.analysis_sessions s WHERE s.owner_id = auth.uid()
    )
  );

-- Team members can insert events in team-visible sessions
CREATE POLICY "Team members can insert team session events"
  ON public.analysis_events FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND session_id IN (
      SELECT s.id FROM public.analysis_sessions s
      WHERE s.deleted_at IS NULL
        AND s.visibility = 'team'
        AND s.team_id IN (
          SELECT tm.team_id FROM public.team_members tm WHERE tm.user_id = auth.uid()
        )
    )
  );

-- Event owner can update their own events
CREATE POLICY "Users can update their own analysis events"
  ON public.analysis_events FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());

-- Session owner can update any event in their session
CREATE POLICY "Session owner can update analysis events"
  ON public.analysis_events FOR UPDATE
  TO authenticated
  USING (
    session_id IN (
      SELECT s.id FROM public.analysis_sessions s WHERE s.owner_id = auth.uid()
    )
  );

-- Soft-delete RPC: event owner OR session owner
CREATE OR REPLACE FUNCTION public.soft_delete_analysis_event(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.analysis_events
  SET deleted_at = now()
  WHERE id = p_event_id
    AND deleted_at IS NULL
    AND (
      owner_id = auth.uid()
      OR session_id IN (
        SELECT s.id FROM public.analysis_sessions s WHERE s.owner_id = auth.uid()
      )
    );
END;
$$;

-- ============================================================
-- 2. MIGRATE EXISTING BOOKMARKS JSONB → analysis_events
-- ============================================================

-- Move existing bookmarks from the JSONB column into the new table.
-- Session owner becomes the event owner for all pre-existing bookmarks.
INSERT INTO public.analysis_events (id, session_id, owner_id, time, comment, category, created_at)
SELECT
  COALESCE((b->>'id')::uuid, gen_random_uuid()),
  s.id,
  s.owner_id,
  (b->>'time')::float8,
  COALESCE(b->>'comment', ''),
  CASE WHEN b->>'category' IN ('kickoff', 'halftime', 'start_2nd_half', 'end')
       THEN b->>'category'
       ELSE NULL
  END,
  COALESCE(to_timestamp((b->>'createdAt')::bigint / 1000.0), now())
FROM public.analysis_sessions s,
     jsonb_array_elements(s.bookmarks) AS b
WHERE s.deleted_at IS NULL
  AND jsonb_array_length(s.bookmarks) > 0;

-- ============================================================
-- 3. UPDATED CLIP RLS — allow team members to collaborate
-- ============================================================

-- Team members can insert clips into team-visible sessions
CREATE POLICY "Team members can insert team session clips"
  ON public.analysis_clips FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND session_id IN (
      SELECT s.id FROM public.analysis_sessions s
      WHERE s.deleted_at IS NULL
        AND s.visibility = 'team'
        AND s.team_id IN (
          SELECT tm.team_id FROM public.team_members tm WHERE tm.user_id = auth.uid()
        )
    )
  );

-- Session owner can update any clip in their session
CREATE POLICY "Session owner can update team session clips"
  ON public.analysis_clips FOR UPDATE
  TO authenticated
  USING (
    session_id IN (
      SELECT s.id FROM public.analysis_sessions s WHERE s.owner_id = auth.uid()
    )
  );

-- Updated soft-delete RPC: clip owner OR session owner
CREATE OR REPLACE FUNCTION public.soft_delete_analysis_clip(p_clip_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.analysis_clips
  SET deleted_at = now()
  WHERE id = p_clip_id
    AND deleted_at IS NULL
    AND (
      owner_id = auth.uid()
      OR session_id IN (
        SELECT s.id FROM public.analysis_sessions s WHERE s.owner_id = auth.uid()
      )
    );
END;
$$;

-- ============================================================
-- 4. STORAGE — team members can read shared clip media
-- ============================================================

-- Team members can read media files belonging to clips in team-visible sessions
CREATE POLICY "Team members can read team analysis media"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'analysis-media'
    AND EXISTS (
      SELECT 1
      FROM public.analysis_clips c
      JOIN public.analysis_sessions s ON s.id = c.session_id
      WHERE c.deleted_at IS NULL
        AND s.deleted_at IS NULL
        AND s.visibility = 'team'
        AND (c.storage_path = name OR c.thumbnail_path = name)
        AND s.team_id IN (
          SELECT tm.team_id FROM public.team_members tm WHERE tm.user_id = auth.uid()
        )
    )
  );
