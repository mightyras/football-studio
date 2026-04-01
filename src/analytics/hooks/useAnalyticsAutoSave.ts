import { useEffect, useRef } from 'react';
import { useAnalytics } from '../AnalyticsContext';
import { updateSession } from '../services/analysisService';

const DEBOUNCE_MS = 2500;

/**
 * Auto-saves bookmarks and session name to Supabase when they change.
 * Follows the same debounce + flush-on-unmount pattern as useMatchAutoSave.
 */
export function useAnalyticsAutoSave() {
  const { state, dispatch } = useAnalytics();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextRef = useRef(false);
  const prevSessionIdRef = useRef(state.sessionId);

  // Keep refs up-to-date for unmount flush
  const bookmarksRef = useRef(state.bookmarks);
  bookmarksRef.current = state.bookmarks;
  const sessionNameRef = useRef(state.sessionName);
  sessionNameRef.current = state.sessionName;
  const sessionIdRef = useRef(state.sessionId);
  sessionIdRef.current = state.sessionId;

  // When sessionId changes (new session loaded), skip the next auto-save
  useEffect(() => {
    if (prevSessionIdRef.current !== state.sessionId) {
      skipNextRef.current = true;
      prevSessionIdRef.current = state.sessionId;
    }
  }, [state.sessionId]);

  // Debounced save of bookmarks + name
  const triggerSave = () => {
    if (!state.sessionId) return;

    if (skipNextRef.current) {
      skipNextRef.current = false;
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      dispatch({ type: 'SET_SAVE_STATUS', status: 'saving' });

      const updates: { bookmarks: typeof state.bookmarks; name?: string } = {
        bookmarks: state.bookmarks,
      };
      if (state.sessionName) {
        updates.name = state.sessionName;
      }

      const ok = await updateSession(state.sessionId!, updates);

      dispatch({ type: 'SET_SAVE_STATUS', status: ok ? 'saved' : 'error' });

      if (ok) {
        setTimeout(() => dispatch({ type: 'SET_SAVE_STATUS', status: 'idle' }), 2000);
      }
    }, DEBOUNCE_MS);
  };

  // Watch bookmarks for changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { triggerSave(); return () => { if (timerRef.current) clearTimeout(timerRef.current); }; }, [state.bookmarks]);

  // Watch session name for changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { triggerSave(); return () => { if (timerRef.current) clearTimeout(timerRef.current); }; }, [state.sessionName]);

  // Flush pending save on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        const sid = sessionIdRef.current;
        const bm = bookmarksRef.current;
        const name = sessionNameRef.current;
        if (sid) {
          const updates: { bookmarks: typeof bm; name?: string } = { bookmarks: bm };
          if (name) updates.name = name;
          updateSession(sid, updates);
        }
      }
    };
  }, []);
}
