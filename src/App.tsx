import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import { AppStateProvider, useAppState, extractSceneData } from './state/AppStateContext';
import { PitchCanvas } from './components/Canvas/PitchCanvas';
import { Toolbar } from './components/Toolbar/Toolbar';
import { RightPanel } from './components/RightPanel/RightPanel';
import { TopBar } from './components/TopBar/TopBar';
import { StatusBar } from './components/StatusBar/StatusBar';
import { KeyframeStrip } from './components/AnimationPanel/KeyframeStrip';
import { PlaybackControls } from './components/AnimationPanel/PlaybackControls';
import { ExportDialog } from './components/AnimationPanel/ExportDialog';
import { DeletePlayerConfirmDialog } from './components/DeletePlayerConfirmDialog';
import { GoalCelebrationOverlay } from './components/GoalCelebrationOverlay';
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
import { computeStepOrder, computeOneTouchIndices, ONE_TOUCH_DURATION_MS, type LineAnnotation } from './animation/annotationAnimator';
import { ExportController, type ExportOptions } from './animation/exportController';
import { RunAnimExportController } from './animation/runAnimExportController';
import type { AnimationSequence, CurvedRunAnnotation, GoalCelebration, PanelTab, PlayerRunAnimation, QueuedAnimation } from './types';
import { renderSceneToBlob } from './utils/sceneRenderer';
import { curvedRunControlPoint } from './utils/curveGeometry';
import { playKickSound, playGoalNetSound } from './utils/sound';
import { findClosestGhost } from './utils/ghostUtils';

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

  // Auth (for gating save behind sign-in)
  const { user, loading: authLoading, needsPasswordSetup, clearPasswordSetup } = useAuth();
  const { activeTeam } = useTeam();
  const [showAuthFromSave, setShowAuthFromSave] = useState(false);

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

      // Full board reset
      dispatch({ type: 'RESET' });
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
  }, [activeTeam]); // eslint-disable-line react-hooks/exhaustive-deps

  // Right panel visibility (hidden by default)
  const [showPanel, setShowPanel] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTab>('settings');
  const [saveSceneRequested, setSaveSceneRequested] = useState(false);

  // Animation playback hook
  const {
    controllerRef,
    status: playbackStatus,
    currentIndex: playbackIndex,
    progress: playbackProgress,
    play,
    pause,
    stop,
    seekToKeyframe,
    setSpeed,
  } = usePlayback(state.animationSequence);

  // ── Per-player run animation (Space key / Play Lines) ──
  // Array of concurrent animations (same-step animations run simultaneously)
  const playerRunAnimRef = useRef<PlayerRunAnimation[]>([]);
  const animationQueueRef = useRef<QueuedAnimation[]>([]);

  // ── Arrow key step-through ──
  const stepQueueRef = useRef<QueuedAnimation[]>([]);
  const completedStepBatchesRef = useRef<{ batch: QueuedAnimation[]; undoCount: number }[]>([]);

  // ── Copy-to-clipboard toast ──
  const [copyToast, setCopyToast] = useState(false);
  const copyToastTimer = useRef<ReturnType<typeof setTimeout>>();

  // ── Goal celebration ──
  const [goalCelebration, setGoalCelebration] = useState<GoalCelebration | null>(null);
  const goalCelebrationRef = useRef<GoalCelebration | null>(null);

  const handleGoalScored = useCallback((celebration: GoalCelebration) => {
    setGoalCelebration(celebration);
    goalCelebrationRef.current = celebration;
    playGoalNetSound();
  }, []);

  const handleGoalDismiss = useCallback(() => {
    setGoalCelebration(null);
  }, []);

  // Playback ref for PitchCanvas (Animation Mode only now)
  const activePlaybackRef = controllerRef;

  // ── Export ──
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportSequence, setExportSequence] = useState<AnimationSequence | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const exportControllerRef = useRef<ExportController | RunAnimExportController | null>(null);

  const handleOpenExport = useCallback((seq: AnimationSequence) => {
    setExportSequence(seq);
    setShowExportDialog(true);
    setExporting(false);
    setExportProgress(0);
  }, []);

  const handleExportLines = useCallback(() => {
    // Open export dialog for run-animation export (no sequence needed)
    setExportSequence(null);
    setShowExportDialog(true);
    setExporting(false);
    setExportProgress(0);
  }, []);

  const handleExportKeyframes = useCallback(() => {
    if (!state.animationSequence || state.animationSequence.keyframes.length < 2) return;
    handleOpenExport(state.animationSequence);
  }, [state.animationSequence, handleOpenExport]);

  const handleExport = useCallback(async (options: ExportOptions) => {
    setExporting(true);
    setExportProgress(0);

    try {
      let blob: Blob;

      if (exportSequence) {
        // Keyframe-based export (Animation Mode)
        const controller = new ExportController(exportSequence, state, options);
        exportControllerRef.current = controller;
        blob = await controller.exportWebM((progress) => {
          setExportProgress(progress);
        });
      } else {
        // Run-animation export (Lines)
        const controller = new RunAnimExportController(state, options);
        exportControllerRef.current = controller;
        blob = await controller.exportWebM((progress) => {
          setExportProgress(progress);
        });
      }

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `animation-export.webm`;
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
      const animationType: 'run' | 'pass' | 'dribble' =
        ann.type === 'passing-line' ? 'pass'
        : ann.type === 'dribble-line' ? 'dribble'
        : 'run';
      const isOneTouch = oneTouchIndices.has(idx);
      queue.push({
        annotationId: ann.id,
        playerId: ann.startPlayerId ?? '',
        endPos: ann.end,
        curveDirection: ann.type === 'curved-run'
          ? ((ann as CurvedRunAnnotation).curveDirection ?? 'left')
          : undefined,
        durationMs: isOneTouch ? ONE_TOUCH_DURATION_MS : 1000,
        animationType,
        endPlayerId: ann.endPlayerId,
        isOneTouch,
        step: ordered[idx].step,
      });
    }
    if (queue.length === 0) return null;

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
      const animationType: 'run' | 'pass' | 'dribble' =
        ann.type === 'passing-line' ? 'pass'
        : ann.type === 'dribble-line' ? 'dribble'
        : 'run';
      const isOneTouch = oneTouchIndices.has(idx);
      queue.push({
        annotationId: ann.id,
        playerId: ann.startPlayerId ?? '',
        endPos: ann.end,
        curveDirection: ann.type === 'curved-run'
          ? ((ann as CurvedRunAnnotation).curveDirection ?? 'left')
          : undefined,
        durationMs: isOneTouch ? ONE_TOUCH_DURATION_MS : 1000,
        animationType,
        endPlayerId: ann.endPlayerId,
        isOneTouch,
        step: ordered[idx].step,
      });
    }
    if (queue.length === 0) return null;

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

      // Compute control point for curved runs
      const controlPoint = item.curveDirection
        ? curvedRunControlPoint(startPos, resolvedEndPos, item.curveDirection)
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
        startTime: nowMs,
        durationMs: item.durationMs,
        animationType: item.animationType,
        endPlayerId: item.endPlayerId,
        isOneTouch: item.isOneTouch,
      });
    }

    playerRunAnimRef.current = startedAnims;
  }, [state, dispatch]);

  // ── Play Lines button handler (plays ALL annotations, like Space but without needing selection) ──
  const handlePlayLines = useCallback(() => {
    if (playerRunAnimRef.current.length > 0) return; // already animating

    // Cancel any active stepping session
    stepQueueRef.current = [];
    completedStepBatchesRef.current = [];

    const result = buildAnimQueueForAll();
    if (!result) return;
    const { queue, allLineAnns } = result;

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
        if (state.animationMode && playbackStatus !== 'idle') {
          stop();
          return;
        }
        // Cancel arrow-key stepping session
        if (stepQueueRef.current.length > 0 || completedStepBatchesRef.current.length > 0) {
          playerRunAnimRef.current = [];
          stepQueueRef.current = [];
          completedStepBatchesRef.current = [];
          dispatch({ type: 'STAMP_GHOST_FADE_START', time: performance.now() });
          return;
        }
        dispatch({ type: 'SELECT_PLAYER', playerId: null });
        dispatch({ type: 'SELECT_ANNOTATION', annotationId: null });
        dispatch({ type: 'CANCEL_DRAWING' });
      }
      // Delete selected player or annotation
      if (e.key === 'Delete' || e.key === 'Backspace') {
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

          const result = buildAnimQueue();
          if (!result) return;
          const { queue, selectedId, isReplay, allLineAnns } = result;

          const player = state.players.find(p => p.id === selectedId);
          if (!player) return;

          const existingGhost = state.ghostPlayers.find(g => g.playerId === player.id);
          if (isReplay && existingGhost) {
            dispatch({ type: 'RESET_RUN', playerId: player.id });
          } else if (existingGhost) {
            dispatch({ type: 'CLEAR_PLAYER_GHOSTS', playerId: player.id });
          }

          // Pull first batch (same step = simultaneous)
          const firstStep = queue[0].step;
          const batch: QueuedAnimation[] = [];
          while (queue.length > 0 && queue[0].step === firstStep) {
            batch.push(queue.shift()!);
          }

          // Store remaining queue for PitchCanvas to auto-advance through
          animationQueueRef.current = queue;

          // For replay, player position hasn't updated yet — provide override
          const overrides = isReplay && existingGhost
            ? new Map([[player.id, { x: existingGhost.x, y: existingGhost.y }]])
            : undefined;
          startAnimBatch(batch, allLineAnns, [], overrides);
        }
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
            if (!result) return;
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
      // Animation mode toggle
      if (e.key === 'f' && !e.metaKey && !e.ctrlKey) {
        dispatch({
          type: state.animationMode ? 'EXIT_ANIMATION_MODE' : 'ENTER_ANIMATION_MODE',
        });
      }
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
        if (!user) {
          setShowAuthFromSave(true);
        } else {
          setShowPanel(true);
          setPanelTab('scenes');
          setSaveSceneRequested(true);
        }
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
  }, [dispatch, state, playbackStatus, playbackIndex, play, pause, stop, seekToKeyframe, zoom, buildAnimQueue, startAnimBatch]);

  const totalKeyframes = state.animationSequence?.keyframes.length ?? 0;

  // Playback control handlers
  const handlePrev = () => {
    if (playbackStatus !== 'idle') {
      seekToKeyframe(Math.max(0, playbackIndex - 1));
    } else if (state.activeKeyframeIndex !== null) {
      dispatch({ type: 'SELECT_KEYFRAME', index: Math.max(0, state.activeKeyframeIndex - 1) });
    }
  };

  const handleNext = () => {
    const maxIdx = totalKeyframes - 1;
    if (playbackStatus !== 'idle') {
      seekToKeyframe(Math.min(maxIdx, playbackIndex + 1));
    } else if (state.activeKeyframeIndex !== null) {
      dispatch({ type: 'SELECT_KEYFRAME', index: Math.min(maxIdx, state.activeKeyframeIndex + 1) });
    }
  };

  const handleSeekStart = () => {
    if (playbackStatus !== 'idle') {
      seekToKeyframe(0);
    } else {
      dispatch({ type: 'SELECT_KEYFRAME', index: 0 });
    }
  };

  const handleSeekEnd = () => {
    const maxIdx = totalKeyframes - 1;
    if (playbackStatus !== 'idle') {
      seekToKeyframe(maxIdx);
    } else if (maxIdx >= 0) {
      dispatch({ type: 'SELECT_KEYFRAME', index: maxIdx });
    }
  };

  const handleSpeedChange = (speed: number) => {
    setSpeed(speed);
    dispatch({ type: 'SET_ANIMATION_SPEED', speedMultiplier: speed });
  };

  return (
    <div className={`app-layout ${showPanel ? 'app-layout--panel-open' : ''} ${state.animationMode ? 'app-layout--animation' : ''}`}>
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
        />
      </div>
      <InviteBanner />
      <div className="toolbar">
        <Toolbar />
      </div>
      <div className="canvas-area">
        <PresenceBar onlineUsers={collaboration.onlineUsers} isConnected={collaboration.isConnected} onLeave={handleLeaveCollaboration} />
        <PitchCanvas playbackRef={activePlaybackRef} playerRunAnimRef={playerRunAnimRef} animationQueueRef={animationQueueRef} goalCelebrationRef={goalCelebrationRef} onGoalScored={handleGoalScored} zoom={zoom} />
      </div>
      {state.animationMode ? (
        <>
          <div className="keyframe-strip">
            <KeyframeStrip onExport={handleExportKeyframes} />
          </div>
          <div className="playback-controls">
            <PlaybackControls
              status={playbackStatus}
              currentIndex={playbackStatus !== 'idle' ? playbackIndex : (state.activeKeyframeIndex ?? 0)}
              progress={playbackProgress}
              totalKeyframes={totalKeyframes}
              speedMultiplier={state.animationSequence?.speedMultiplier ?? 1}
              onPlay={play}
              onPause={pause}
              onStop={stop}
              onPrev={handlePrev}
              onNext={handleNext}
              onSeekStart={handleSeekStart}
              onSeekEnd={handleSeekEnd}
              onSpeedChange={handleSpeedChange}
            />
          </div>
        </>
      ) : null}
      <div className="formations">
        <RightPanel
          rotation={zoom.rotation}
          activeTab={panelTab}
          onTabChange={setPanelTab}
          saveRequested={saveSceneRequested}
          onSaveHandled={() => setSaveSceneRequested(false)}
          onRequestSignIn={() => setShowAuthFromSave(true)}
          onStartCollaboration={handleStartCollaboration}
        />
      </div>
      <div className="statusbar">
        <StatusBar />
      </div>

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

      {/* Auth modal triggered from save hint */}
      {showAuthFromSave && (
        <AuthModal onClose={() => setShowAuthFromSave(false)} />
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
      <AppContent />
    </AppStateProvider>
  );
}

export default App;
