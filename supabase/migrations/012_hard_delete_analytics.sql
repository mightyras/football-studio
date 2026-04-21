-- Replace soft_delete_* RPCs with hard-delete versions.
-- Soft delete left storage files orphaned forever (~600MB leak).
-- FKs are ON DELETE CASCADE, so removing a session removes its clips,
-- events, and source_files automatically. Storage cleanup happens in
-- the client before the RPC call (see analysisService.ts).

DROP FUNCTION IF EXISTS public.soft_delete_analysis_session(uuid);
DROP FUNCTION IF EXISTS public.soft_delete_analysis_clip(uuid);
DROP FUNCTION IF EXISTS public.soft_delete_analysis_event(uuid);

CREATE OR REPLACE FUNCTION public.delete_analysis_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.analysis_sessions
  WHERE id = p_session_id AND owner_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_analysis_clip(p_clip_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.analysis_clips
  WHERE id = p_clip_id
    AND (
      owner_id = auth.uid()
      OR session_id IN (
        SELECT s.id FROM public.analysis_sessions s WHERE s.owner_id = auth.uid()
      )
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_analysis_event(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.analysis_events
  WHERE id = p_event_id
    AND (
      owner_id = auth.uid()
      OR session_id IN (
        SELECT s.id FROM public.analysis_sessions s WHERE s.owner_id = auth.uid()
      )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_analysis_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_analysis_clip(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_analysis_event(uuid) TO authenticated;
