import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import { AppStateProvider, useAppState, extractSceneData } from './state/AppStateContext';
import { PitchCanvas } from './components/Canvas/PitchCanvas';
import { Toolbar } from './components/Toolbar/Toolbar';
import { RightPanel } from './components/RightPanel/RightPanel';
import { TopBar } from './components/TopBar/TopBar';
import { StatusBar } from './components/StatusBar/StatusBar';
// KeyframeStrip and PlaybackControls hidden — Animation Mode UI disabled for now
// import { KeyframeStrip } from './components/AnimationPanel/KeyframeStrip';
// import { PlaybackControls } from './components/AnimationPanel/PlaybackControls';
import { ExportDialog } from './components/AnimationPanel/ExportDialog';
import { DeletePlayerConfirmDialog } from './components/DeletePlayerConfirmDialog';
// GoalCelebrationOverlay imported for future use
// import { GoalCelebrationOverlay } from './components/GoalCelebrationOverlay';
import { MatchTimeline } from './components/MatchManagement/MatchTimeline';
import { InviteBanner } from './components/TeamPanel/InviteBanner';
import { PresenceBar } from './components/CollaborationPanel/PresenceBar';
import { AuthModal } from './components/AuthModal/AuthModal';
import { SetPasswordModal } from './components/AuthModal/SetPasswordModal';
import { useAuth } from './state/AuthContext';
import { useTeam } from './state/TeamContext';
import { THEME } from './constants/colors';
import { usePlayback } from './hooks/usePlayback';
import { useZoom } from './hooks/useZoom';
import { useCollaboration } from './hooks/useCollaboration';
import { useThemeColors } from './hooks/useThemeColors';
import { computeStepOrder, computeOneTouchIndices, ONE_TOUCH_DURATION_MS, ANIM_DURATION_MS, PASS_LEAD_DELAY_MS, type LineAnnotation } from './animation/annotationAnimator';
import { ExportController, type ExportOptions } from './animation/exportController';
import { RunAnimExportController } from './animation/runAnimExportController';
import type { AnimationSequence, CurvedRunAnnotation, GoalCelebration, PanelTab, PassingLineAnnotation, PlayerRunAnimation, QueuedAnimation } from './types';
import { renderSceneToBlob } from './utils/sceneRenderer';
import { curvedRunControlPoint, loftedArcControlPoint } from './utils/curveGeometry';
import { playKickSound, playGoalNetSound } from './utils/sound';
import { findClosestGhost } from './utils/ghostUtils';
import { TourProvider, useTour } from './components/Tour/useTour';
import { TourOverlay } from './components/Tour/TourOverlay';
import { WelcomeModal } from './components/WelcomeModal/WelcomeModal';
import { Sentry } from './lib/sentry';
import { useSentryUser } from './hooks/useSentryUser';
import { AnalyticsView } from './analytics/AnalyticsView';

export type AppView = 'editor' | 'analytics';

function SentryFallback({ resetError }: { resetError?: () => void }) {
  return (
    <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>
      <p style={{ margin: '0 0 8px' }}>Something went wrong.</p>
      {resetError && (
        <button
          onClick={resetError}
          style={{
            padding: '6px 16px',
            borderRadius: 4,
            border: '1px solid #555',
            background: 'transparent',
            color: '#ccc',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Try again
        </button>
      )}
    </div>
  );
}

function AppContent() {
  const { state, dispatch, setDispatchInterceptor } = useAppState();
  const themeColors = useThemeColors();

  // Sync CSS custom properties for body/canvas backgrounds
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--theme-primary', themeColors.primary);
    root.style.setProperty('--theme-secondary', themeColors.secondary);
    root.style.setProperty('--theme-background', themeColors.background);
    root.style.setProperty('--theme-border-subtle', themeColors.borderSubtle);
    root.style.setProperty('--theme-surface', themeColors.surface);
  }, [themeColors.primary, themeColors.secondary, themeColors.background, themeColors.borderSubtle, themeColors.surface]);

  // Zoom/pan state (view-layer only, not in app reducer)
  const zoom = useZoom();

  // Auth (gate entire app behind sign-in)
  const { user, loading: authLoading, needsPasswordSetup, clearPasswordSetup } = useAuth();
  const { activeTeam } = useTeam();
  const tour = useTour();

  // Sync Supabase user ID to Sentry context (UUID only, no PII)
  useSentryUser();

  // Welcome modal for first-time users
  const [showWelcome, setShowWelcome] = useState(false);
  useEffect(() => {
    if (user && !localStorage.getItem('football-studio-welcome-seen')) {
      setShowWelcome(true);
    }
  }, [user]);

  // Refs for session auto-save/restore across sign-out/sign-in
  const stateRef = useRef(state);
  stateRef.current = state;
  const prevUserIdRef = useRef<string | null>(null);
  const initialLoadRef = useRef(true);

  // ── Real-time collaboration ──
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [collabIsOwner, setCollabIsOwner] = useState(false);
  const [collabPermission, setCollabPermission] = useState<'view' | 'edit' | 'owner'>('edit');

  const userDisplayName = user?.user_metadata?.display_name ?? user?.email?.split('@')[0] ?? null;

  const collaboration = useCollaboration(
    activeBoardId,
    dispatch,
    stateRef,
    user?.id ?? null,
    userDisplayName,
    collabIsOwner,
    collabPermission,
  );

  // Register collaboration sendAction as the dispatch interceptor
  useEffect(() => {
    if (collaboration.isConnected) {
      setDispatchInterceptor(collaboration.sendAction);
    } else {
      setDispatchInterceptor(null);
    }
    return () => setDispatchInterceptor(null);
  }, [collaboration.isConnected, collaboration.sendAction, setDispatchInterceptor]);

  // When user opens a collaborative board from ScenesPanel
  const handleStartCollaboration = useCallback((boardId: string, isOwner: boolean, permission: 'view' | 'edit' | 'owner') => {
    setActiveBoardId(boardId);
    setCollabIsOwner(isOwner);
    setCollabPermission(permission);
  }, []);

  // Leave collaboration
  const handleLeaveCollaboration = useCallback(() => {
    collaboration.disconnect();
    setActiveBoardId(null);
    setCollabIsOwner(false);
    setCollabPermission('edit');
  }, [collaboration]);

  // Auto-save session on sign-out, full board reset, auto-restore on sign-in
  useEffect(() => {
    if (authLoading) return;

    const prevUserId = prevUserIdRef.current;
    const currentUserId = user?.id ?? null;

    // Skip the very first auth resolution (page load — state already restored from localStorage)
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      prevUserIdRef.current = currentUserId;
      return;
    }

    // Sign-out: user was signed in, now signed out
    if (!currentUserId && prevUserId) {
      // Leave any active collaboration
      if (activeBoardId) {
        handleLeaveCollaboration();
      }

      // Auto-save session for this user before resetting
      try {
        const sceneData = extractSceneData(stateRef.current);
        localStorage.setItem(`football-studio-session-${prevUserId}`, JSON.stringify(sceneData));
      } catch { /* storage full — silently ignore */ }

      // Full board reset (including zoom/rotation)
      zoom.resetZoom();
      dispatch({ type: 'RESET', defaultFormationId: activeTeam?.default_formation_id });
      dispatch({ type: 'SET_TEAM_COLOR', team: 'A', color: THEME.teamA });
      dispatch({ type: 'SET_TEAM_COLOR', team: 'B', color: THEME.teamB });
      dispatch({ type: 'SET_TEAM_OUTLINE_COLOR', team: 'A', color: '#000000' });
      dispatch({ type: 'SET_TEAM_OUTLINE_COLOR', team: 'B', color: '#000000' });
      dispatch({ type: 'SET_CLUB_IDENTITY', identity: {
        primaryColor: null,
        secondaryColor: null,
        highlightColor: null,
        backgroundColor: null,
        logoDataUrl: null,
      }});
      dispatch({ type: 'RENAME_TEAM', team: 'A', name: 'My Team' });
      dispatch({ type: 'RENAME_TEAM', team: 'B', name: 'Opposition' });
    }

    // Sign-in: user was signed out, now signed in
    if (currentUserId && !prevUserId) {
      const saved = localStorage.getItem(`football-studio-session-${currentUserId}`);
      if (saved) {
        try {
          dispatch({ type: 'LOAD_SCENE', data: JSON.parse(saved) });
        } catch { /* corrupt data — ignore */ }
      }
    }

    prevUserIdRef.current = currentUserId;
  }, [user, authLoading, dispatch]);

  // Sync team A name + colours from active team on sign-in
  useEffect(() => {
    if (!activeTeam) return;

    if (state.teamAName === 'My Team') {
      dispatch({ type: 'RENAME_TEAM', team: 'A', name: activeTeam.name });
    }

    // Always apply team colours when activeTeam is available
    if (activeTeam.player_color) {
      dispatch({ type: 'SET_TEAM_COLOR', team: 'A', color: activeTeam.player_color });
    }
    if (activeTeam.outline_color) {
      dispatch({ type: 'SET_TEAM_OUTLINE_COLOR', team: 'A', color: activeTeam.outline_color });
    }

    // Sync team logo URL for marker overlay
    dispatch({ type: 'SET_TEAM_LOGO_URL', url: activeTeam.logo_url ?? null });
  }, [activeTeam]); // eslint-disable-line react-hooks/exhaustive-deps

  // Right panel visibility (hidden by default, unless match management is active)
  const [showPanel, setShowPanel] = useState(state.matchManagementMode);
  const [panelTab, setPanelTab] = useState<PanelTab>(state.matchManagementMode ? 'match' : 'settings');
  const [activeView, setActiveView] = useState<AppView>('editor');

  // Auto-close the match panel when match management mode is exited
  // (e.g. via the "Exit Match Management" button inside MatchDashboard)
  useEffect(() => {
    if (!state.matchManagementMode && panelTab === 'match') {
      setPanelTab('settings');
      setShowPanel(false);
    }
  }, [state.matchManagementMode, panelTab]);

  const [saveSceneRequested, setSaveSceneRequested] = useState(false);

  // Animation playback hook
  const {
    controllerRef,
    status: playbackStatus,
    currentIndex: playbackIndex,
    // progress: playbackProgress, // Animation Mode UI disabled
    play,
    pause,
    stop,
    seekToKeyframe,
    // setSpeed, // Animation Mode UI disabled
  } = usePlayback(state.animationSequence);

  // ── Per-player run animation (Space key / Play Lines) ──
  // Array of concurrent animations (same-step animations run simultaneously)
  const playerRunAnimRef = useRef<PlayerRunAnimation[]>([]);
  const animationQueueRef = useRef<QueuedAnimation[]>([]);

  // ── Arrow key step-through ──
  const stepQueueRef = useRef<QueuedAnimation[]>([]);
  const completedStepBatchesRef = useRef<{ batch: QueuedAnimation[]; undoCount: number }[]>([]);

  // ── Replay tracking: how many EXECUTE_RUNs happened in the last Space sequence ──
  const lastSequenceUndoCountRef = useRef(0);
  const lastSequencePlayerIdRef = useRef<string | null>(null);
  const replayAfterUndoRef = useRef(false);

  // ── Copy-to-clipboard toast ──
  const [copyToast, setCopyToast] = useState(false);
  const copyToastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── Restore-annotations toast ──
  const [restoreToast, setRestoreToast] = useState(false);
  const restoreToastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── Post-animation restore: tracks EXECUTE_RUN count for play-all / step-all ──
  const restoreUndoCountRef = useRef(0);
  // Guards against spurious re-calls of handlePlayLines after animation completes.
  // Set true when play-all starts; cleared on Escape-restore, toast dismiss, or new session.
  const playAllActiveRef = useRef(false);

  // ── Goal celebration ──
  const [, setGoalCelebration] = useState<GoalCelebration | null>(null);
  const goalCelebrationRef = useRef<GoalCelebration | null>(null);

  const handleGoalScored = useCallback((celebration: GoalCelebration) => {
    setGoalCelebration(celebration);
    goalCelebrationRef.current = celebration;
    playGoalNetSound();
  }, []);

  // Playback ref for PitchCanvas (Animation Mode only now)
  const activePlaybackRef = controllerRef;

  // ── Export ──
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportSequence, setExportSequence] = useState<AnimationSequence | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const exportControllerRef = useRef<ExportController | RunAnimExportController | null>(null);

  // Animation Mode UI disabled — handleOpenExport commented out
  // const handleOpenExport = useCallback((seq: AnimationSequence) => {
  //   setExportSequence(seq);
  //   setShowExportDialog(true);
  //   setExporting(false);
  //   setExportProgress(0);
  // }, []);

  const handleExportLines = useCallback(() => {
    // Open export dialog for run-animation export (no sequence needed)
    setExportSequence(null);
    setShowExportDialog(true);
    setExporting(false);
    setExportProgress(0);
  }, []);

  // Animation Mode UI disabled — handleExportKeyframes commented out
  // const handleExportKeyframes = useCallback(() => {
  //   if (!state.animationSequence || state.animationSequence.keyframes.length < 2) return;
  //   handleOpenExport(state.animationSequence);
  // }, [state.animationSequence, handleOpenExport]);

  const handleExport = useCallback(async (options: ExportOptions) => {
    setExporting(true);
    setExportProgress(0);

    try {
      let blob: Blob;
      let format: 'mp4' | 'webm';

      if (exportSequence) {
        // Keyframe-based export (Animation Mode)
        const controller = new ExportController(exportSequence, state, options);
        exportControllerRef.current = controller;
        const result = await controller.export((progress) => {
          setExportProgress(progress);
        });
        blob = result.blob;
        format = result.format;
      } else {
        // Run-animation export (Lines)
        const controller = new RunAnimExportController(state, options);
        exportControllerRef.current = controller;
        const result = await controller.export((progress) => {
          setExportProgress(progress);
        });
        blob = result.blob;
        format = result.format;
      }

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `animation-export.${format}`;
      a.click();
      URL.revokeObjectURL(url);

      setShowExportDialog(false);
    } catch (err) {
      if ((err as Error).message !== 'Export cancelled') {
        console.error('Export failed:', err);
      }
    } finally {
      setExporting(false);
      exportControllerRef.current = null;
    }
  }, [exportSequence, state]);

  const handleExportCancel = useCallback(() => {
    if (exporting) {
      exportControllerRef.current?.cancel();
    }
    setShowExportDialog(false);
    setExportSequence(null);
    setExporting(false);
    setExportProgress(0);
  }, [exporting]);

  // ── Shared helpers for Space auto-play and arrow-key stepping ──

  /** Build the full animation queue from current annotations */
  const buildAnimQueue = useCallback((): { queue: QueuedAnimation[]; selectedId: string; isReplay: boolean; allLineAnns: LineAnnotation[] } | null => {
    // Determine the triggering player: either directly selected, or derived from a selected line annotation
    let selectedId = state.selectedPlayerId;
    if (!selectedId && state.selectedAnnotationId) {
      const selAnn = state.annotations.find(a => a.id === state.selectedAnnotationId);
      if (selAnn && 'startPlayerId' in selAnn && selAnn.startPlayerId) {
        selectedId = selAnn.startPlayerId;
      }
    }
    if (!selectedId) return null;

    const animatableTypes = ['running-line', 'curved-run', 'passing-line', 'dribble-line'] as const;
    const allLineAnns = state.annotations.filter(
      (a): a is LineAnnotation => (animatableTypes as readonly string[]).includes(a.type),
    );

    const playerAnns = allLineAnns.filter(a => a.startPlayerId === selectedId);
    if (playerAnns.length === 0) return null;

    const nonGhostPlayerAnns = playerAnns.filter(a => !state.ghostAnnotationIds.includes(a.id));
    const ghostPlayerAnns = playerAnns.filter(a => state.ghostAnnotationIds.includes(a.id));
    const isReplay = nonGhostPlayerAnns.length === 0 && ghostPlayerAnns.length > 0;

    const ghostIds = new Set(state.ghostAnnotationIds);
    const annsToAnimate = allLineAnns.filter(a =>
      isReplay ? true : !ghostIds.has(a.id)
    );
    if (annsToAnimate.length === 0) return null;

    const stepOrder = computeStepOrder(annsToAnimate);
    type AnnWithStep = { ann: LineAnnotation; step: number };
    const ordered: AnnWithStep[] = annsToAnimate.map((ann, i) => ({
      ann,
      step: stepOrder ? stepOrder[i] : (ann.animStep ?? 1),
    }));
    ordered.sort((a, b) => a.step - b.step);

    const orderedAnns = ordered.map(o => o.ann);
    const oneTouchIndices = computeOneTouchIndices(orderedAnns);

    const queue: QueuedAnimation[] = [];
    for (let idx = 0; idx < ordered.length; idx++) {
      const { ann } = ordered[idx];
      const isLofted = ann.type === 'passing-line' && (ann as PassingLineAnnotation).passType === 'lofted';
      const animationType: 'run' | 'pass' | 'dribble' =
        ann.type === 'passing-line' ? 'pass'
        : ann.type === 'dribble-line' ? 'dribble'
        : 'run';
      const isOneTouch = oneTouchIndices.has(idx);
      const baseDuration = isLofted ? ANIM_DURATION_MS.loftedPass : ANIM_DURATION_MS[animationType];
      queue.push({
        annotationId: ann.id,
        playerId: ann.startPlayerId ?? '',
        endPos: ann.end,
        curveDirection: ann.type === 'curved-run'
          ? ((ann as CurvedRunAnnotation).curveDirection ?? 'left')
          : isLofted
            ? ((ann as PassingLineAnnotation).curveDirection ?? 'left')
            : undefined,
        durationMs: isOneTouch ? ONE_TOUCH_DURATION_MS : baseDuration,
        animationType,
        endPlayerId: ann.endPlayerId,
        isOneTouch,
        isLofted: isLofted || undefined,
        step: ordered[idx].step,
      });
    }
    if (queue.length === 0) return null;

    // Sync pass duration to target runner's duration so ball and player arrive together.
    // Also add a lead delay so the runner gets a head start before the ball is kicked.
    for (const item of queue) {
      if (item.animationType === 'pass' && item.endPlayerId) {
        const targetRun = queue.find(
          q => q.playerId === item.endPlayerId && q.step === item.step && q.animationType !== 'pass'
        );
        if (targetRun) {
          const totalDuration = Math.max(item.durationMs, targetRun.durationMs);
          const delay = Math.min(PASS_LEAD_DELAY_MS, totalDuration * 0.3); // cap at 30% of total
          item.startDelay = delay;
          item.durationMs = totalDuration - delay; // pass covers remaining time after delay
        }
      }
    }

    return { queue, selectedId, isReplay, allLineAnns };
  }, [state]);

  /** Build animation queue for ALL line annotations (used by Play Lines / Step / Export) */
  const buildAnimQueueForAll = useCallback((): { queue: QueuedAnimation[]; allLineAnns: LineAnnotation[] } | null => {
    const animatableTypes = ['running-line', 'curved-run', 'passing-line', 'dribble-line'] as const;
    const allLineAnns = state.annotations.filter(
      (a): a is LineAnnotation => (animatableTypes as readonly string[]).includes(a.type),
    );
    const nonGhostAnns = allLineAnns.filter(a => !state.ghostAnnotationIds.includes(a.id));
    if (nonGhostAnns.length === 0) return null;

    const stepOrder = computeStepOrder(nonGhostAnns);
    type AnnWithStep = { ann: LineAnnotation; step: number };
    const ordered: AnnWithStep[] = nonGhostAnns.map((ann, i) => ({
      ann,
      step: stepOrder ? stepOrder[i] : (ann.animStep ?? 1),
    }));
    ordered.sort((a, b) => a.step - b.step);

    const orderedAnns = ordered.map(o => o.ann);
    const oneTouchIndices = computeOneTouchIndices(orderedAnns);

    const queue: QueuedAnimation[] = [];
    for (let idx = 0; idx < ordered.length; idx++) {
      const { ann } = ordered[idx];
      const isLofted = ann.type === 'passing-line' && (ann as PassingLineAnnotation).passType === 'lofted';
      const animationType: 'run' | 'pass' | 'dribble' =
        ann.type === 'passing-line' ? 'pass'
        : ann.type === 'dribble-line' ? 'dribble'
        : 'run';
      const isOneTouch = oneTouchIndices.has(idx);
      const baseDuration = isLofted ? ANIM_DURATION_MS.loftedPass : ANIM_DURATION_MS[animationType];
      queue.push({
        annotationId: ann.id,
        playerId: ann.startPlayerId ?? '',
        endPos: ann.end,
        curveDirection: ann.type === 'curved-run'
          ? ((ann as CurvedRunAnnotation).curveDirection ?? 'left')
          : isLofted
            ? ((ann as PassingLineAnnotation).curveDirection ?? 'left')
            : undefined,
        durationMs: isOneTouch ? ONE_TOUCH_DURATION_MS : baseDuration,
        animationType,
        endPlayerId: ann.endPlayerId,
        isOneTouch,
        isLofted: isLofted || undefined,
        step: ordered[idx].step,
      });
    }
    if (queue.length === 0) return null;

    // Sync pass duration to target runner's duration so ball and player arrive together.
    // Also add a lead delay so the runner gets a head start before the ball is kicked.
    for (const item of queue) {
      if (item.animationType === 'pass' && item.endPlayerId) {
        const targetRun = queue.find(
          q => q.playerId === item.endPlayerId && q.step === item.step && q.animationType !== 'pass'
        );
        if (targetRun) {
          const totalDuration = Math.max(item.durationMs, targetRun.durationMs);
          const delay = Math.min(PASS_LEAD_DELAY_MS, totalDuration * 0.3);
          item.startDelay = delay;
          item.durationMs = totalDuration - delay;
        }
      }
    }

    return { queue, allLineAnns };
  }, [state]);

  /** Start a batch of animations from the queue, resolving positions dynamically */
  const startAnimBatch = useCallback((
    batch: QueuedAnimation[],
    allLineAnns: LineAnnotation[],
    finishedAnims: PlayerRunAnimation[] = [],
    startOverrides?: Map<string, { x: number; y: number }>,
  ) => {
    const nowMs = performance.now();
    const startedAnims: PlayerRunAnimation[] = [];
    let didKick = false;

    for (const item of batch) {
      // Resolve start position
      let startPos: { x: number; y: number } | undefined;

      // Check explicit overrides first (used for replay: state is stale after RESET_RUN)
      if (startOverrides?.has(item.playerId)) {
        startPos = startOverrides.get(item.playerId);
      }

      // Check just-finished animations (state may be stale)
      if (!startPos) for (const fa of finishedAnims) {
        if (item.playerId === fa.playerId) {
          const faType = fa.animationType ?? 'run';
          startPos = faType === 'pass'
            ? { x: fa.startPos.x, y: fa.startPos.y }
            : { x: fa.endPos.x, y: fa.endPos.y };
          break;
        }
      }

      if (!startPos) {
        // Check if the annotation starts from a preview ghost (future position)
        const annForItem = allLineAnns.find(a => a.id === item.annotationId);
        const realP = state.players.find(p => p.id === item.playerId);
        const pg = annForItem ? findClosestGhost(state.previewGhosts, item.playerId, annForItem.start) : undefined;
        if (annForItem && pg && realP) {
          const dxReal = annForItem.start.x - realP.x;
          const dyReal = annForItem.start.y - realP.y;
          const distReal = dxReal * dxReal + dyReal * dyReal;
          const dxGhost = annForItem.start.x - pg.x;
          const dyGhost = annForItem.start.y - pg.y;
          const distGhost = dxGhost * dxGhost + dyGhost * dyGhost;
          startPos = distGhost < distReal ? { x: pg.x, y: pg.y } : { x: realP.x, y: realP.y };
        } else if (realP) {
          startPos = { x: realP.x, y: realP.y };
        } else {
          startPos = { x: 0, y: 0 };
        }
      }

      // Resolve endPos dynamically if targeting a player
      let resolvedEndPos = item.endPos;
      if (item.endPlayerId) {
        // Check if the target player has a same-batch run (simultaneous run + pass)
        const sameBatchRun = batch.find(
          b => b.playerId === item.endPlayerId && b.animationType !== 'pass'
        );
        if (sameBatchRun) {
          // Pass should go to where the player is running TO, not where they are now
          resolvedEndPos = sameBatchRun.endPos;
        } else {
          // Check if the target player was moved by a just-finished animation
          const finishedForTarget = finishedAnims.find(
            fa => fa.playerId === item.endPlayerId && (fa.animationType ?? 'run') !== 'pass'
          );
          if (finishedForTarget) {
            resolvedEndPos = { x: finishedForTarget.endPos.x, y: finishedForTarget.endPos.y };
          } else {
            const targetPlayer = state.players.find(p => p.id === item.endPlayerId);
            if (targetPlayer) {
              resolvedEndPos = { x: targetPlayer.x, y: targetPlayer.y };
            }
          }
        }
      }

      // Compute control point for curved runs / lofted passes
      const controlPoint = item.curveDirection
        ? (item.isLofted
            ? loftedArcControlPoint(startPos, resolvedEndPos, item.curveDirection)
            : curvedRunControlPoint(startPos, resolvedEndPos, item.curveDirection))
        : item.controlPoint;

      // For pass/dribble: snap ball to start player
      if (item.animationType === 'pass' || item.animationType === 'dribble') {
        dispatch({ type: 'MOVE_BALL', x: startPos.x, y: startPos.y });
      }
      if (item.animationType === 'pass' && !didKick) {
        playKickSound();
        didKick = true;
      }

      startedAnims.push({
        playerId: item.playerId,
        annotationId: item.annotationId,
        startPos,
        endPos: resolvedEndPos,
        controlPoint,
        startTime: nowMs + (item.startDelay ?? 0),
        durationMs: item.durationMs,
        animationType: item.animationType,
        endPlayerId: item.endPlayerId,
        isOneTouch: item.isOneTouch,
        isLofted: item.isLofted,
      });
    }

    playerRunAnimRef.current = startedAnims;
  }, [state, dispatch]);

  // ── Play Lines button handler (plays ALL annotations, like Space but without needing selection) ──
  const handlePlayLines = useCallback(() => {
    if (playerRunAnimRef.current.length > 0) return; // already animating
    if (playAllActiveRef.current) return; // play-all cycle completed, awaiting restore/dismiss

    // Cancel any active stepping session
    stepQueueRef.current = [];
    completedStepBatchesRef.current = [];

    // Clear previous restore state
    clearTimeout(restoreToastTimer.current);
    setRestoreToast(false);

    const result = buildAnimQueueForAll();
    if (!result) return;
    const { queue, allLineAnns } = result;

    // Track total EXECUTE_RUN count for post-animation Escape restore
    restoreUndoCountRef.current = queue.length;
    playAllActiveRef.current = true;

    // Clear existing ghosts for all involved players
    const involvedPlayerIds = new Set(queue.map(q => q.playerId));
    for (const pid of involvedPlayerIds) {
      const existingGhost = state.ghostPlayers.find(g => g.playerId === pid);
      if (existingGhost) {
        dispatch({ type: 'CLEAR_PLAYER_GHOSTS', playerId: pid });
      }
    }

    // Pull first batch (same step = simultaneous)
    const firstStep = queue[0].step;
    const batch: QueuedAnimation[] = [];
    while (queue.length > 0 && queue[0].step === firstStep) {
      batch.push(queue.shift()!);
    }

    // Store remaining for PitchCanvas to auto-advance through
    animationQueueRef.current = queue;
    startAnimBatch(batch, allLineAnns);
  }, [state, dispatch, buildAnimQueueForAll, startAnimBatch]);

  // ── Step Lines button handler (step-by-step through ALL annotations, like Right arrow) ──
  const handleStepLines = useCallback(() => {
    if (playerRunAnimRef.current.length > 0) return; // animation playing

    // If no stepping queue yet, build one (first press)
    if (stepQueueRef.current.length === 0 && completedStepBatchesRef.current.length === 0) {
      // Cancel any active auto-play
      animationQueueRef.current = [];

      const result = buildAnimQueueForAll();
      if (!result) return;
      const { queue } = result;

      // Clear existing ghosts for all involved players
      const involvedPlayerIds = new Set(queue.map(q => q.playerId));
      for (const pid of involvedPlayerIds) {
        const existingGhost = state.ghostPlayers.find(g => g.playerId === pid);
        if (existingGhost) {
          dispatch({ type: 'CLEAR_PLAYER_GHOSTS', playerId: pid });
        }
      }

      stepQueueRef.current = queue;
      completedStepBatchesRef.current = [];
      restoreUndoCountRef.current = 0;
      playAllActiveRef.current = false;
      clearTimeout(restoreToastTimer.current);
      setRestoreToast(false);
    }

    // Pull next batch from step queue
    const queue = stepQueueRef.current;
    if (queue.length === 0) {
      // All steps played — end stepping session
      stepQueueRef.current = [];
      completedStepBatchesRef.current = [];
      dispatch({ type: 'STAMP_GHOST_FADE_START', time: performance.now() });
      return;
    }

    const nextStep = queue[0].step;
    const batch: QueuedAnimation[] = [];
    while (queue.length > 0 && queue[0].step === nextStep) {
      batch.push(queue.shift()!);
    }

    // Track for Left arrow undo
    completedStepBatchesRef.current.push({ batch, undoCount: batch.length });
    restoreUndoCountRef.current += batch.length;

    // Don't store in animationQueueRef — PitchCanvas won't auto-advance
    const animatableTypes = ['running-line', 'curved-run', 'passing-line', 'dribble-line'] as const;
    const allLineAnns = state.annotations.filter(
      (a): a is LineAnnotation => (animatableTypes as readonly string[]).includes(a.type),
    );
    startAnimBatch(batch, allLineAnns);
  }, [state, dispatch, buildAnimQueueForAll, startAnimBatch]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't handle shortcuts while editing a player or annotation
      if (state.editingPlayerId || state.editingAnnotationId || state.pendingDeletePlayerId) return;

      if (e.key === 'Escape') {
        // Priority 1: Animation Mode playback stop
        if (state.animationMode && playbackStatus !== 'idle') {
          stop();
          return;
        }

        // Priority 2: Mid-animation cancel — stop running animations, stamp ghosts, no undo
        if (playerRunAnimRef.current.length > 0) {
          playerRunAnimRef.current = [];
          animationQueueRef.current = [];
          stepQueueRef.current = [];
          completedStepBatchesRef.current = [];
          restoreUndoCountRef.current = 0;
          playAllActiveRef.current = false;
          lastSequenceUndoCountRef.current = 0;
          lastSequencePlayerIdRef.current = null;
          clearTimeout(restoreToastTimer.current);
          setRestoreToast(false);
          dispatch({ type: 'STAMP_GHOST_FADE_START', time: performance.now() });
          return;
        }

        // Priority 3: Active stepping session — undo completed steps, cancel remaining
        if (stepQueueRef.current.length > 0 || completedStepBatchesRef.current.length > 0) {
          const totalUndos = completedStepBatchesRef.current.reduce(
            (sum, b) => sum + b.undoCount, 0
          );
          const clampedUndos = Math.min(totalUndos, state.undoStack.length);
          for (let i = 0; i < clampedUndos; i++) {
            dispatch({ type: 'UNDO' });
          }
          stepQueueRef.current = [];
          completedStepBatchesRef.current = [];
          restoreUndoCountRef.current = 0;
          playAllActiveRef.current = false;
          clearTimeout(restoreToastTimer.current);
          setRestoreToast(false);
          return;
        }

        // Priority 4: Post-play-all restore — undo all EXECUTE_RUNs
        if (restoreUndoCountRef.current > 0) {
          const clampedUndos = Math.min(restoreUndoCountRef.current, state.undoStack.length);
          for (let i = 0; i < clampedUndos; i++) {
            dispatch({ type: 'UNDO' });
          }
          restoreUndoCountRef.current = 0;
          playAllActiveRef.current = false;
          clearTimeout(restoreToastTimer.current);
          setRestoreToast(false);
          return;
        }

        // Priority 5: Post-per-player restore — undo all EXECUTE_RUNs
        if (lastSequenceUndoCountRef.current > 0) {
          const clampedUndos = Math.min(lastSequenceUndoCountRef.current, state.undoStack.length);
          for (let i = 0; i < clampedUndos; i++) {
            dispatch({ type: 'UNDO' });
          }
          lastSequenceUndoCountRef.current = 0;
          lastSequencePlayerIdRef.current = null;
          clearTimeout(restoreToastTimer.current);
          setRestoreToast(false);
          return;
        }

        // Priority 6: Default — deselect all
        dispatch({ type: 'SELECT_PLAYER', playerId: null });
        dispatch({ type: 'SELECT_ANNOTATION', annotationId: null });
        dispatch({ type: 'CANCEL_DRAWING' });
      }
      // Delete selected player or annotation (disabled in match management mode)
      if ((e.key === 'Delete' || e.key === 'Backspace') && !state.matchManagementMode) {
        if (state.selectedAnnotationId) {
          dispatch({ type: 'DELETE_ANNOTATION', annotationId: state.selectedAnnotationId });
        } else if (state.selectedPlayerId) {
          dispatch({ type: 'SET_PENDING_DELETE_PLAYER', playerId: state.selectedPlayerId });
        }
      }
      // Enter commits in-progress polygon/player-polygon/player-line
      if (e.key === 'Enter' && state.drawingInProgress) {
        if (state.drawingInProgress.type === 'polygon' && state.drawingInProgress.points.length >= 3) {
          dispatch({
            type: 'ADD_ANNOTATION',
            annotation: {
              id: `ann-${Date.now()}`,
              type: 'polygon',
              points: state.drawingInProgress.points,
              fillColor: '#ffffff',
              fillOpacity: 0.15,
              strokeColor: '#ffffff',
            },
          });
          dispatch({ type: 'CANCEL_DRAWING' });
        }
        if (state.drawingInProgress.type === 'player-polygon' && state.drawingInProgress.playerIds.length >= 3) {
          dispatch({
            type: 'ADD_ANNOTATION',
            annotation: {
              id: `ann-${Date.now()}`,
              type: 'player-polygon',
              playerIds: state.drawingInProgress.playerIds,
              fillColor: '#ffffff',
              fillOpacity: 0.15,
              strokeColor: '#ffffff',
            },
          });
          dispatch({ type: 'CANCEL_DRAWING' });
        }
        if (state.drawingInProgress.type === 'player-line' && state.drawingInProgress.playerIds.length >= 2) {
          dispatch({
            type: 'ADD_ANNOTATION',
            annotation: {
              id: `ann-${Date.now()}`,
              type: 'player-line',
              playerIds: state.drawingInProgress.playerIds,
              color: '#ffffff',
              lineWidth: 0.8,
            },
          });
          dispatch({ type: 'CANCEL_DRAWING' });
        }
      }

      // ── Per-player run/pass/dribble animation (Space = auto-play all steps) ──
      if ((e.key === ' ' || e.code === 'Space') && !state.animationMode) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable) return;
        e.preventDefault();
        if (!state.drawingInProgress && playerRunAnimRef.current.length === 0) {
          // Cancel any active stepping session
          stepQueueRef.current = [];
          completedStepBatchesRef.current = [];

          // Clear play-all restore state when starting per-player animation
          restoreUndoCountRef.current = 0;
          playAllActiveRef.current = false;
          clearTimeout(restoreToastTimer.current);
          setRestoreToast(false);

          let result = buildAnimQueue();

          // If no animations found but we know a previous sequence ran,
          // undo those EXECUTE_RUNs to restore annotations, then auto-replay
          // once React has processed the undo state updates.
          if (!result && lastSequenceUndoCountRef.current > 0 && lastSequencePlayerIdRef.current) {
            const undoCount = lastSequenceUndoCountRef.current;
            for (let i = 0; i < undoCount; i++) {
              dispatch({ type: 'UNDO' });
            }
            lastSequenceUndoCountRef.current = 0;
            replayAfterUndoRef.current = true;
            return;
          }

          if (!result) {
            handlePlayLines();
            return;
          }
          const { queue, selectedId, isReplay, allLineAnns } = result;

          const player = state.players.find(p => p.id === selectedId);
          if (!player) return;

          const existingGhost = state.ghostPlayers.find(g => g.playerId === player.id);
          if (isReplay && existingGhost) {
            dispatch({ type: 'RESET_RUN', playerId: player.id });
          } else if (existingGhost) {
            dispatch({ type: 'CLEAR_PLAYER_GHOSTS', playerId: player.id });
          }

          // Track total EXECUTE_RUN count for replay-via-undo
          const totalAnimCount = queue.length;

          // Pull first batch (same step = simultaneous)
          const firstStep = queue[0].step;
          const batch: QueuedAnimation[] = [];
          while (queue.length > 0 && queue[0].step === firstStep) {
            batch.push(queue.shift()!);
          }

          // Store remaining queue for PitchCanvas to auto-advance through
          animationQueueRef.current = queue;

          // Track for replay: each animation triggers one EXECUTE_RUN
          lastSequenceUndoCountRef.current = totalAnimCount;
          lastSequencePlayerIdRef.current = selectedId;

          // For replay, player position hasn't updated yet — provide override
          const overrides = isReplay && existingGhost
            ? new Map([[player.id, { x: existingGhost.x, y: existingGhost.y }]])
            : undefined;
          startAnimBatch(batch, allLineAnns, [], overrides);
        }
        return;
      }

      // ── Match Management: arrow keys navigate timeline ──
      if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && state.matchManagementMode) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable) return;
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        const newMin = e.key === 'ArrowRight'
          ? Math.min(state.matchCurrentMinute + step, state.matchPlan?.hasExtraTime ? 120 : 90)
          : Math.max(state.matchCurrentMinute - step, 0);
        dispatch({ type: 'SET_MATCH_MINUTE', minute: newMin });
        return;
      }

      // ── Arrow key step-through (Right = next step, Left = undo last step) ──
      if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !state.animationMode && !state.drawingInProgress) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable) return;

        // Right arrow: advance to next step
        if (e.key === 'ArrowRight') {
          // If animation is currently playing, ignore (let it finish)
          if (playerRunAnimRef.current.length > 0) return;

          // If no stepping queue yet, build one (first press)
          let replayOverrides: Map<string, { x: number; y: number }> | undefined;
          if (stepQueueRef.current.length === 0 && completedStepBatchesRef.current.length === 0) {
            const result = buildAnimQueue();
            if (!result) {
              e.preventDefault();
              handleStepLines();
              return;
            }
            const { queue, selectedId, isReplay } = result;

            const player = state.players.find(p => p.id === selectedId);
            if (!player) return;

            const existingGhost = state.ghostPlayers.find(g => g.playerId === player.id);
            if (isReplay && existingGhost) {
              dispatch({ type: 'RESET_RUN', playerId: player.id });
              // State hasn't updated yet — provide start position override
              replayOverrides = new Map([[player.id, { x: existingGhost.x, y: existingGhost.y }]]);
            } else if (existingGhost) {
              dispatch({ type: 'CLEAR_PLAYER_GHOSTS', playerId: player.id });
            }

            stepQueueRef.current = queue;
            completedStepBatchesRef.current = [];
          }

          // Pull next batch from step queue
          const queue = stepQueueRef.current;
          if (queue.length === 0) {
            // All steps played — end stepping session
            stepQueueRef.current = [];
            completedStepBatchesRef.current = [];
            dispatch({ type: 'STAMP_GHOST_FADE_START', time: performance.now() });
            return;
          }

          e.preventDefault();
          const nextStep = queue[0].step;
          const batch: QueuedAnimation[] = [];
          while (queue.length > 0 && queue[0].step === nextStep) {
            batch.push(queue.shift()!);
          }

          // Track for Left arrow undo
          completedStepBatchesRef.current.push({ batch, undoCount: batch.length });

          // Don't store in animationQueueRef — PitchCanvas won't auto-advance
          const animatableTypes = ['running-line', 'curved-run', 'passing-line', 'dribble-line'] as const;
          const allLineAnns = state.annotations.filter(
            (a): a is LineAnnotation => (animatableTypes as readonly string[]).includes(a.type),
          );
          startAnimBatch(batch, allLineAnns, [], replayOverrides);
          return;
        }

        // Left arrow: undo last completed step
        if (e.key === 'ArrowLeft') {
          if (playerRunAnimRef.current.length > 0) return; // animation playing, ignore
          if (completedStepBatchesRef.current.length === 0) return; // nothing to undo

          e.preventDefault();
          const last = completedStepBatchesRef.current.pop()!;

          // Undo the EXECUTE_RUN dispatches (one per animation in the batch)
          for (let i = 0; i < last.undoCount; i++) {
            dispatch({ type: 'UNDO' });
          }

          // Prepend the batch back to the step queue
          stepQueueRef.current = [...last.batch, ...stepQueueRef.current];
          return;
        }
      }

      // ── Animation mode shortcuts ──
      if (state.animationMode) {
        // Space = play/pause
        if (e.key === ' ' || e.code === 'Space') {
          const tag = (e.target as HTMLElement)?.tagName;
          if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable) return;
          e.preventDefault();
          if (playbackStatus === 'playing') {
            pause();
          } else {
            play();
          }
          return;
        }
        // Left arrow = previous keyframe
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          if (playbackStatus !== 'idle') {
            const prevIdx = Math.max(0, playbackIndex - 1);
            seekToKeyframe(prevIdx);
          } else {
            const prevIdx = Math.max(0, (state.activeKeyframeIndex ?? 0) - 1);
            dispatch({ type: 'SELECT_KEYFRAME', index: prevIdx });
          }
          return;
        }
        // Right arrow = next keyframe
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          const maxIdx = (state.animationSequence?.keyframes.length ?? 1) - 1;
          if (playbackStatus !== 'idle') {
            const nextIdx = Math.min(maxIdx, playbackIndex + 1);
            seekToKeyframe(nextIdx);
          } else {
            const nextIdx = Math.min(maxIdx, (state.activeKeyframeIndex ?? 0) + 1);
            dispatch({ type: 'SELECT_KEYFRAME', index: nextIdx });
          }
          return;
        }
        // Shift+C = capture keyframe
        if (e.key === 'C' && e.shiftKey) {
          e.preventDefault();
          dispatch({ type: 'CAPTURE_KEYFRAME' });
          return;
        }
      }

      // Don't trigger tool shortcuts when match management or bench panel is active
      if (state.matchManagementMode || state.activeBench !== null) return;

      if (e.key === 'v' || e.key === 'V') {
        dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'select' });
      }
      if (e.key === 'a' && !e.metaKey && !e.ctrlKey) {
        dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'add-player' });
      }
      if (e.key === 'd' && !e.metaKey && !e.ctrlKey) {
        dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'delete' });
      }
      // Draw tool shortcuts
      if (e.key === 'w' && !e.metaKey && !e.ctrlKey) {
        dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'draw' });
      }
      if (e.key === 't' && !e.metaKey && !e.ctrlKey) {
        dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'draw' });
        dispatch({ type: 'SET_DRAW_SUB_TOOL', subTool: 'text' });
      }
      if (e.key === 'p' && !e.metaKey && !e.ctrlKey) {
        dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'draw' });
        dispatch({ type: 'SET_DRAW_SUB_TOOL', subTool: 'passing-line' });
      }
      if (e.key === 'i' && !e.metaKey && !e.ctrlKey) {
        dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'draw' });
        dispatch({ type: 'SET_DRAW_SUB_TOOL', subTool: 'lofted-pass' });
      }
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey) {
        dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'draw' });
        dispatch({ type: 'SET_DRAW_SUB_TOOL', subTool: 'running-line' });
      }
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey) {
        dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'draw' });
        dispatch({ type: 'SET_DRAW_SUB_TOOL', subTool: 'curved-run' });
      }
      if (e.key === 'b' && !e.metaKey && !e.ctrlKey) {
        dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'draw' });
        dispatch({ type: 'SET_DRAW_SUB_TOOL', subTool: 'dribble-line' });
      }
      if (e.key === 'g' && !e.metaKey && !e.ctrlKey) {
        dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'draw' });
        dispatch({ type: 'SET_DRAW_SUB_TOOL', subTool: 'polygon' });
      }
      if (e.key === 'h' && !e.metaKey && !e.ctrlKey) {
        dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'draw' });
        dispatch({ type: 'SET_DRAW_SUB_TOOL', subTool: 'player-polygon' });
      }
      if (e.key === 'l' && !e.metaKey && !e.ctrlKey) {
        dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'draw' });
        dispatch({ type: 'SET_DRAW_SUB_TOOL', subTool: 'player-line' });
      }
      if (e.key === 'e' && !e.metaKey && !e.ctrlKey) {
        dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'draw' });
        dispatch({ type: 'SET_DRAW_SUB_TOOL', subTool: 'ellipse' });
      }
      if (e.key === 'm' && !e.metaKey && !e.ctrlKey) {
        dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'draw' });
        dispatch({ type: 'SET_DRAW_SUB_TOOL', subTool: 'player-marking' });
      }
      // Formation move tool
      if (e.key === 'x' && !e.metaKey && !e.ctrlKey) {
        dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'formation-move' });
      }
      // Animation mode toggle (disabled — feature hidden from UI)
      // if (e.key === 'f' && !e.metaKey && !e.ctrlKey) {
      //   dispatch({
      //     type: state.animationMode ? 'EXIT_ANIMATION_MODE' : 'ENTER_ANIMATION_MODE',
      //   });
      // }
      // Orientation toggle
      if (e.key === 'o' && !e.metaKey && !e.ctrlKey) {
        dispatch({ type: 'SET_SHOW_ORIENTATION', show: !state.showOrientation });
      }
      // Cover shadow toggle (only when orientation is on)
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        if (state.showOrientation) {
          dispatch({ type: 'SET_SHOW_COVER_SHADOW', show: !state.showCoverShadow });
        }
      }
      // FOV mode cycle (only when orientation is on): V cycles off → A → B → both
      if (e.key === 'v' && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        if (state.showOrientation) {
          const cycle: Array<'off' | 'A' | 'B' | 'both'> = ['off', 'A', 'B', 'both'];
          const idx = cycle.indexOf(state.fovMode);
          const next = cycle[(idx + 1) % cycle.length];
          dispatch({ type: 'SET_FOV_MODE', mode: next });
        }
      }
      // FOV expanded / peripheral vision toggle: Shift+V
      if (e.key === 'V' && e.shiftKey && !e.metaKey && !e.ctrlKey) {
        if (state.fovMode !== 'off') {
          dispatch({ type: 'SET_FOV_EXPANDED', expanded: !state.fovExpanded });
        }
      }
      // Undo
      if (e.key === 'z' && e.metaKey && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
      }
      // Redo
      if (e.key === 'z' && e.metaKey && e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'REDO' });
      }
      // Zoom presets (skip when a line annotation is selected — number keys edit step)
      const hasSelectedLine = state.selectedAnnotationId && state.annotations.some(
        a => a.id === state.selectedAnnotationId &&
          (a.type === 'passing-line' || a.type === 'running-line' || a.type === 'curved-run' || a.type === 'dribble-line'),
      );
      if (!hasSelectedLine) {
        if (e.key === '1' && !e.metaKey && !e.ctrlKey) {
          zoom.setPreset('full');
        }
        if (e.key === '2' && !e.metaKey && !e.ctrlKey) {
          zoom.setPreset('top-half');
        }
        if (e.key === '3' && !e.metaKey && !e.ctrlKey) {
          zoom.setPreset('bottom-half');
        }
        if (e.key === '0' && !e.metaKey && !e.ctrlKey) {
          zoom.resetZoom();
        }
      }
      // Zoom in/out with Cmd +/-
      if ((e.key === '=' || e.key === '+') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        zoom.zoomIn();
      }
      if (e.key === '-' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        zoom.zoomOut();
      }
      // Rotate pitch (Shift+R to avoid conflict with 'r' for running-line)
      if (e.key === 'R' && e.shiftKey && !e.metaKey && !e.ctrlKey) {
        zoom.rotateCW();
      }

      // ── Scene shortcuts ──

      // Cmd+S / Ctrl+S — Save Scene
      if (e.key === 's' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        setShowPanel(true);
        setPanelTab('scenes');
        setSaveSceneRequested(true);
      }

      // Cmd+Shift+E / Ctrl+Shift+E — Export PNG
      if (e.key === 'e' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        renderSceneToBlob(state).then(blob => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${state.teamAName}-vs-${state.teamBName}.png`.replace(/[^a-zA-Z0-9_.-]/g, '_');
          a.click();
          URL.revokeObjectURL(url);
        });
      }

      // Cmd+C / Ctrl+C — Copy scene to clipboard as image
      if (e.key === 'c' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        renderSceneToBlob(state).then(blob => {
          navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(() => {
            clearTimeout(copyToastTimer.current);
            setCopyToast(true);
            copyToastTimer.current = setTimeout(() => setCopyToast(false), 1500);
          }).catch(() => {});
        });
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch, state, playbackStatus, playbackIndex, play, pause, stop, seekToKeyframe, zoom, buildAnimQueue, startAnimBatch, handlePlayLines, handleStepLines]);

  // ── Auto-replay after undo restores annotations ──
  useEffect(() => {
    if (!replayAfterUndoRef.current) return;
    replayAfterUndoRef.current = false;

    // State is now fresh after undo — annotations are restored.
    // Re-trigger the animation sequence.
    const result = buildAnimQueue();
    if (!result) return;
    const { queue, selectedId, allLineAnns } = result;

    const player = state.players.find(p => p.id === selectedId);
    if (!player) return;

    // Clean up any leftover ghosts
    const existingGhost = state.ghostPlayers.find(g => g.playerId === player.id);
    if (existingGhost) {
      dispatch({ type: 'CLEAR_PLAYER_GHOSTS', playerId: player.id });
    }

    // Pull first batch
    const firstStep = queue[0].step;
    const batch: QueuedAnimation[] = [];
    while (queue.length > 0 && queue[0].step === firstStep) {
      batch.push(queue.shift()!);
    }

    animationQueueRef.current = queue;
    lastSequenceUndoCountRef.current = batch.length + queue.length;
    lastSequencePlayerIdRef.current = selectedId;

    startAnimBatch(batch, allLineAnns);
  }, [state, buildAnimQueue, startAnimBatch, dispatch]);

  // ── Show "Press Esc to restore" toast when animations complete ──
  useEffect(() => {
    // Only show toast if there's something to restore
    const hasRestore = restoreUndoCountRef.current > 0 || lastSequenceUndoCountRef.current > 0;
    if (!hasRestore) return;

    // Detect completion: ghost players exist with createdAt > 0
    const hasStampedGhosts = state.ghostPlayers.some(g => g.createdAt > 0);
    if (!hasStampedGhosts) return;

    // Don't show if actively animating or stepping
    if (playerRunAnimRef.current.length > 0) return;
    if (animationQueueRef.current.length > 0) return;
    if (stepQueueRef.current.length > 0) return;

    // Show toast with auto-dismiss
    clearTimeout(restoreToastTimer.current);
    setRestoreToast(true);
    restoreToastTimer.current = setTimeout(() => {
      setRestoreToast(false);
      // Allow play-all to be triggered again after toast expires
      playAllActiveRef.current = false;
    }, 5000);
  }, [state.ghostPlayers]);

  // Animation Mode playback handlers disabled — UI hidden
  // const totalKeyframes = state.animationSequence?.keyframes.length ?? 0;
  // const handlePrev = () => { ... };
  // const handleNext = () => { ... };
  // const handleSeekStart = () => { ... };
  // const handleSeekEnd = () => { ... };
  // const handleSpeedChange = (speed: number) => { ... };

  // Auth gate — require sign-in before accessing the app
  if (authLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: themeColors.background, color: themeColors.secondary,
        fontFamily: 'inherit', fontSize: 14,
      }}>
        Loading…
      </div>
    );
  }

  return (
    <div className={`app-layout ${activeView === 'analytics' ? 'app-layout--analytics' : ''} ${showPanel ? 'app-layout--panel-open' : ''} ${state.matchManagementMode ? 'app-layout--match' : ''}`}>
      <div className="topbar">
        <TopBar
          onPlayLines={handlePlayLines}
          onStepLines={handleStepLines}
          onExportLines={handleExportLines}
          showPanel={showPanel && panelTab === 'settings'}
          onTogglePanel={() => {
            if (showPanel && panelTab === 'settings') {
              setShowPanel(false);
            } else {
              setPanelTab('settings');
              setShowPanel(true);
            }
          }}
          helpActive={showPanel && panelTab === 'help'}
          onOpenHelp={() => {
            if (showPanel && panelTab === 'help') {
              setShowPanel(false);
            } else {
              setPanelTab('help');
              setShowPanel(true);
            }
          }}
          boardsActive={showPanel && panelTab === 'scenes'}
          onOpenBoards={() => {
            if (showPanel && panelTab === 'scenes') {
              setShowPanel(false);
            } else {
              setPanelTab('scenes');
              setShowPanel(true);
            }
          }}
          matchActive={state.matchManagementMode}
          onToggleMatch={() => {
            // Exit analytics if active
            if (activeView === 'analytics') setActiveView('editor');
            if (state.matchManagementMode) {
              dispatch({ type: 'EXIT_MATCH_MANAGEMENT' });
              if (panelTab === 'match') {
                setPanelTab('settings');
                setShowPanel(false);
              }
            } else {
              dispatch({ type: 'ENTER_MATCH_MANAGEMENT' });
              setPanelTab('match');
              setShowPanel(true);
            }
          }}
          analyticsActive={activeView === 'analytics'}
          onToggleAnalytics={() => {
            // Exit match management if active
            if (state.matchManagementMode) {
              dispatch({ type: 'EXIT_MATCH_MANAGEMENT' });
              if (panelTab === 'match') {
                setPanelTab('settings');
                setShowPanel(false);
              }
            }
            setActiveView(v => v === 'analytics' ? 'editor' : 'analytics');
          }}
          onResetZoom={zoom.resetZoom}
        />
      </div>
      {activeView === 'analytics' ? (
        <div className="analytics-area">
          <AnalyticsView />
        </div>
      ) : (
        <>
      <InviteBanner />
      <div className="toolbar">
        <Toolbar />
      </div>
      <div className="canvas-area">
        <PresenceBar onlineUsers={collaboration.onlineUsers} isConnected={collaboration.isConnected} onLeave={handleLeaveCollaboration} />
        <Sentry.ErrorBoundary fallback={<SentryFallback />}>
          <PitchCanvas playbackRef={activePlaybackRef} playerRunAnimRef={playerRunAnimRef} animationQueueRef={animationQueueRef} stepQueueRef={stepQueueRef} completedStepBatchesRef={completedStepBatchesRef} goalCelebrationRef={goalCelebrationRef} onGoalScored={handleGoalScored} zoom={zoom} />
        </Sentry.ErrorBoundary>
      </div>
      {/* Match Management Timeline */}
      {state.matchManagementMode && (
        <div className="match-timeline">
          <MatchTimeline />
        </div>
      )}
      {/* Animation Mode UI hidden — feature preserved in code for future use */}
      <div className="formations">
        <Sentry.ErrorBoundary fallback={<SentryFallback />}>
          <RightPanel
            rotation={zoom.rotation}
            activeTab={panelTab}
            onTabChange={setPanelTab}
            saveRequested={saveSceneRequested}
            onSaveHandled={() => setSaveSceneRequested(false)}
            onRequestSignIn={() => {}}
            onStartCollaboration={handleStartCollaboration}
            onStartTour={() => setShowPanel(false)}
          />
        </Sentry.ErrorBoundary>
      </div>
      <div className="statusbar">
        <StatusBar />
      </div>
        </>
      )}

      {/* Export Dialog */}
      {showExportDialog && (
        <ExportDialog
          onExport={handleExport}
          onCancel={handleExportCancel}
          exporting={exporting}
          progress={exportProgress}
        />
      )}

      {/* Delete Player Confirm Dialog */}
      {state.pendingDeletePlayerId && (() => {
        const player = state.players.find(p => p.id === state.pendingDeletePlayerId);
        if (!player) return null;
        return (
          <DeletePlayerConfirmDialog
            playerName={player.name}
            playerNumber={player.number}
            onConfirm={() => {
              dispatch({ type: 'DELETE_PLAYER', playerId: state.pendingDeletePlayerId! });
              dispatch({ type: 'SET_PENDING_DELETE_PLAYER', playerId: null });
            }}
            onCancel={() => {
              dispatch({ type: 'SET_PENDING_DELETE_PLAYER', playerId: null });
            }}
          />
        );
      })()}
      {/* Goal celebration overlay removed — net ripple still renders on canvas */}

      {/* Copy-to-clipboard toast */}
      {copyToast && (
        <div
          style={{
            position: 'fixed',
            bottom: 48,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.8)',
            color: '#fff',
            padding: '8px 20px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            zIndex: 1200,
            pointerEvents: 'none',
            animation: 'copyToastIn 0.2s ease-out',
          }}
        >
          Copied to clipboard
          <style>{`
            @keyframes copyToastIn {
              from { opacity: 0; transform: translateX(-50%) translateY(8px); }
              to { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
          `}</style>
        </div>
      )}

      {/* Restore-annotations toast */}
      {restoreToast && (
        <div
          style={{
            position: 'fixed',
            bottom: 48,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.8)',
            color: '#fff',
            padding: '8px 20px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            zIndex: 1200,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            animation: 'restoreToastIn 0.2s ease-out',
          }}
        >
          Press{' '}
          <kbd
            style={{
              background: 'rgba(255,255,255,0.15)',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 700,
              border: '1px solid rgba(255,255,255,0.25)',
              fontFamily: 'inherit',
            }}
          >
            Esc
          </kbd>{' '}
          to restore annotations
          <style>{`
            @keyframes restoreToastIn {
              from { opacity: 0; transform: translateX(-50%) translateY(8px); }
              to { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
          `}</style>
        </div>
      )}

      {/* Spotlight walkthrough tour */}
      <TourOverlay />

      {/* Welcome modal for first-time users (after password setup if needed) */}
      {showWelcome && !needsPasswordSetup && (
        <WelcomeModal
          onClose={() => {
            localStorage.setItem('football-studio-welcome-seen', 'true');
            setShowWelcome(false);
          }}
          onStartTour={() => {
            localStorage.setItem('football-studio-welcome-seen', 'true');
            setShowWelcome(false);
            tour.start();
          }}
        />
      )}

      {/* Auth gate — show sign-in overlay when not authenticated */}
      {!user && !authLoading && (
        <AuthModal onClose={() => {}} />
      )}

      {/* Password setup for invited users */}
      {needsPasswordSetup && (
        <SetPasswordModal onClose={clearPasswordSetup} />
      )}
    </div>
  );
}

function App() {
  return (
    <AppStateProvider>
      <TourProvider>
        <AppContent />
      </TourProvider>
    </AppStateProvider>
  );
}

export default App;
