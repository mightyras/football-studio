-- ============================================================
-- Analytics — persistent storage for video analysis sessions,
-- clips (screenshots + video), and bookmarks
-- ============================================================

-- ============================================================
-- ANALYSIS SESSIONS
-- ============================================================

CREATE TABLE public.analysis_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_id       uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  name          text NOT NULL,
  stream_url    text NOT NULL,
  metadata      jsonb,
  bookmarks     jsonb NOT NULL DEFAULT '[]',
  visibility    public.board_visibility NOT NULL DEFAULT 'private',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

CREATE INDEX idx_analysis_sessions_owner ON public.analysis_sessions(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_analysis_sessions_team ON public.analysis_sessions(team_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_analysis_sessions_updated ON public.analysis_sessions(updated_at DESC) WHERE deleted_at IS NULL;

ALTER TABLE public.analysis_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own analysis sessions"
  ON public.analysis_sessions FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL AND owner_id = auth.uid());

CREATE POLICY "Users can insert their own analysis sessions"
  ON public.analysis_sessions FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own analysis sessions"
  ON public.analysis_sessions FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete their own analysis sessions"
  ON public.analysis_sessions FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Team members can view team analysis sessions"
  ON public.analysis_sessions FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND visibility = 'team'
    AND team_id IN (
      SELECT tm.team_id FROM public.team_members tm WHERE tm.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.soft_delete_analysis_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.analysis_sessions
  SET deleted_at = now()
  WHERE id = p_session_id AND owner_id = auth.uid();
END;
$$;

-- ============================================================
-- ANALYSIS CLIPS
-- ============================================================

CREATE TABLE public.analysis_clips (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES public.analysis_sessions(id) ON DELETE CASCADE,
  owner_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type            text NOT NULL CHECK (type IN ('screenshot', 'video')),
  label           text,
  timestamp       float8 NOT NULL,
  in_point        float8,
  out_point       float8,
  storage_path    text NOT NULL,
  thumbnail_path  text,
  annotations     jsonb NOT NULL DEFAULT '[]',
  created_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX idx_analysis_clips_session ON public.analysis_clips(session_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_analysis_clips_owner ON public.analysis_clips(owner_id) WHERE deleted_at IS NULL;

ALTER TABLE public.analysis_clips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own analysis clips"
  ON public.analysis_clips FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL AND owner_id = auth.uid());

CREATE POLICY "Users can insert their own analysis clips"
  ON public.analysis_clips FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own analysis clips"
  ON public.analysis_clips FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete their own analysis clips"
  ON public.analysis_clips FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Team members can view team analysis clips"
  ON public.analysis_clips FOR SELECT
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

CREATE OR REPLACE FUNCTION public.soft_delete_analysis_clip(p_clip_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.analysis_clips
  SET deleted_at = now()
  WHERE id = p_clip_id AND owner_id = auth.uid();
END;
$$;

-- ============================================================
-- STORAGE BUCKET for analysis media (private)
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('analysis-media', 'analysis-media', false);

-- Users can upload to their own folder
CREATE POLICY "Users can upload analysis media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'analysis-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can read their own files
CREATE POLICY "Users can read own analysis media"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'analysis-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own files
CREATE POLICY "Users can delete own analysis media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'analysis-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
