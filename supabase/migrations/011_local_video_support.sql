-- ============================================================
-- Local Video Support — allow sessions based on local files
-- or uploaded video files instead of remote streams.
-- ============================================================

-- ============================================================
-- 1. SESSIONS: make stream_url nullable, add source_type
-- ============================================================

ALTER TABLE public.analysis_sessions ALTER COLUMN stream_url DROP NOT NULL;

ALTER TABLE public.analysis_sessions
  ADD COLUMN source_type text NOT NULL DEFAULT 'stream'
  CHECK (source_type IN ('stream', 'local_file', 'uploaded_files'));

-- ============================================================
-- 2. SOURCE FILES table for uploaded multi-file sessions
-- ============================================================

CREATE TABLE public.analysis_source_files (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid NOT NULL REFERENCES public.analysis_sessions(id) ON DELETE CASCADE,
  owner_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_name    text NOT NULL,
  storage_path text NOT NULL,
  file_size    bigint,
  sort_order   int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);

CREATE INDEX idx_analysis_source_files_session
  ON public.analysis_source_files(session_id) WHERE deleted_at IS NULL;

ALTER TABLE public.analysis_source_files ENABLE ROW LEVEL SECURITY;

-- Owner can CRUD their own source files
CREATE POLICY "Users can view their own source files"
  ON public.analysis_source_files FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL AND owner_id = auth.uid());

CREATE POLICY "Users can insert their own source files"
  ON public.analysis_source_files FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own source files"
  ON public.analysis_source_files FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete their own source files"
  ON public.analysis_source_files FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- Team members can view source files in team-visible sessions
CREATE POLICY "Team members can view team source files"
  ON public.analysis_source_files FOR SELECT
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

-- Team members can insert source files in team-visible sessions
CREATE POLICY "Team members can insert team source files"
  ON public.analysis_source_files FOR INSERT
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

-- ============================================================
-- 3. SCOPE bookmarks and clips to source files
-- ============================================================

ALTER TABLE public.analysis_events
  ADD COLUMN source_file_id uuid REFERENCES public.analysis_source_files(id) ON DELETE SET NULL;

ALTER TABLE public.analysis_clips
  ADD COLUMN source_file_id uuid REFERENCES public.analysis_source_files(id) ON DELETE SET NULL;

-- ============================================================
-- 4. STORAGE — allow reading source file media for team members
-- ============================================================

CREATE POLICY "Team members can read team source file media"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'analysis-media'
    AND EXISTS (
      SELECT 1
      FROM public.analysis_source_files sf
      JOIN public.analysis_sessions s ON s.id = sf.session_id
      WHERE sf.deleted_at IS NULL
        AND s.deleted_at IS NULL
        AND s.visibility = 'team'
        AND sf.storage_path = name
        AND s.team_id IN (
          SELECT tm.team_id FROM public.team_members tm WHERE tm.user_id = auth.uid()
        )
    )
  );

-- ============================================================
-- 5. CASCADE soft-delete to source files when session is deleted
-- ============================================================

CREATE OR REPLACE FUNCTION public.soft_delete_analysis_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.analysis_sessions
  SET deleted_at = now()
  WHERE id = p_session_id AND owner_id = auth.uid();

  -- Cascade soft-delete to source files
  UPDATE public.analysis_source_files
  SET deleted_at = now()
  WHERE session_id = p_session_id AND deleted_at IS NULL;
END;
$$;
