import { useEffect, useRef } from 'react';
import { useAnalytics } from '../AnalyticsContext';
import { updateSession } from '../services/analysisService';

const DEBOUNCE_MS = 2500;

/**
 * Auto-saves session name to Supabase when it changes.
 * Events (formerly bookmarks) are now persisted individually via the
 * analysis_events table, so they are no longer batch-saved here.
 */
export function useAnalyticsAutoSave() {
  const { state, dispatch } = useAnalytics();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSessionIdRef = useRef(state.sessionId);
  const prevSessionNameRef = useRef(state.sessionName);
  const isFirstRenderRef = useRef(true);

  // Keep refs up-to-date for unmount flush
  const sessionNameRef = useRef(state.sessionName);
  sessionNameRef.current = state.sessionName;
  const sessionIdRef = useRef(state.sessionId);
  sessionIdRef.current = state.sessionId;

  useEffect(() => {
    // Skip the very first render
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      prevSessionIdRef.current = state.sessionId;
      prevSessionNameRef.current = state.sessionName;
      return;
    }

    // Skip if session just changed (loaded a different session)
    if (prevSessionIdRef.current !== state.sessionId) {
      prevSessionIdRef.current = state.sessionId;
      prevSessionNameRef.current = state.sessionName;
      return;
    }

    // Skip if name hasn't actually changed
    if (prevSessionNameRef.current === state.sessionName) {
      return;
    }

    prevSessionNameRef.current = state.sessionName;

    if (!state.sessionId || !state.sessionName) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      dispatch({ type: 'SET_SAVE_STATUS', status: 'saving' });

      const ok = await updateSession(state.sessionId!, { name: state.sessionName! });

      dispatch({ type: 'SET_SAVE_STATUS', status: ok ? 'saved' : 'error' });

      if (ok) {
        setTimeout(() => dispatch({ type: 'SET_SAVE_STATUS', status: 'idle' }), 2000);
      }
    }, DEBOUNCE_MS);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [state.sessionId, state.sessionName, dispatch]);

  // Flush pending save on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        const sid = sessionIdRef.current;
        const name = sessionNameRef.current;
        if (sid && name) {
          updateSession(sid, { name });
        }
      }
    };
  }, []);
}
