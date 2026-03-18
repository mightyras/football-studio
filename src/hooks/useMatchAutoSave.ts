import { useEffect, useRef, useState } from 'react';
import { useAppState } from '../state/AppStateContext';
import { updateMatchPlan } from '../services/matchPlanService';
import type { MatchPlanBoardContext } from '../services/matchPlanService';
import { FORMATIONS } from '../constants/formations';

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

const DEBOUNCE_MS = 2500;

export function useMatchAutoSave(): { syncStatus: SyncStatus } {
  const { state } = useAppState();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextRef = useRef(false);
  const prevCloudIdRef = useRef(state.matchPlanCloudId);

  const plan = state.matchPlan;
  const cloudId = state.matchPlanCloudId;

  // Keep refs up-to-date for unmount flush
  const stateRef = useRef(state);
  stateRef.current = state;
  const planRef = useRef(plan);
  planRef.current = plan;
  const cloudIdRef = useRef(cloudId);
  cloudIdRef.current = cloudId;

  // When cloudId changes (new plan created or loaded), skip the next auto-save
  useEffect(() => {
    if (prevCloudIdRef.current !== cloudId) {
      skipNextRef.current = true;
      prevCloudIdRef.current = cloudId;
    }
  }, [cloudId]);

  // Watch matchPlan for changes and auto-save
  useEffect(() => {
    if (!cloudId || !plan) return;

    if (skipNextRef.current) {
      skipNextRef.current = false;
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      setSyncStatus('saving');
      const formationName = FORMATIONS.find(f => f.id === state.teamAFormation)?.name ?? null;
      const boardContext: MatchPlanBoardContext = {
        teamAName: plan.ownKit?.name ?? state.teamAName,
        teamBName: plan.opponent?.name ?? state.teamBName,
        teamAColor: plan.ownKit?.color ?? state.teamAColor,
        teamBColor: plan.opponent?.color ?? state.teamBColor,
        formationName,
        eventCount: plan.events.length,
        ruleMode: plan.ruleMode,
      };

      const ok = await updateMatchPlan(cloudId, {
        name: plan.name,
        data: plan,
        boardContext,
      });

      setSyncStatus(ok ? 'saved' : 'error');
      setTimeout(
        () => setSyncStatus('idle'),
        ok ? 2000 : 3000,
      );
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  // Flush pending save on unmount (use refs for latest values)
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        const cid = cloudIdRef.current;
        const p = planRef.current;
        const s = stateRef.current;
        if (cid && p) {
          const formationName = FORMATIONS.find(f => f.id === s.teamAFormation)?.name ?? null;
          const boardContext: MatchPlanBoardContext = {
            teamAName: p.ownKit?.name ?? s.teamAName,
            teamBName: p.opponent?.name ?? s.teamBName,
            teamAColor: p.ownKit?.color ?? s.teamAColor,
            teamBColor: p.opponent?.color ?? s.teamBColor,
            formationName,
            eventCount: p.events.length,
            ruleMode: p.ruleMode,
          };
          updateMatchPlan(cid, { name: p.name, data: p, boardContext });
        }
      }
    };
  }, []);

  return { syncStatus };
}
