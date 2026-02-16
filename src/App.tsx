import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import { AppStateProvider, useAppState } from './state/AppStateContext';
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
import { usePlayback } from './hooks/usePlayback';
import { useZoom } from './hooks/useZoom';
import { PlaybackController } from './animation/playbackController';
import { buildSequenceFromAnnotations, computeStepOrder, type LineAnnotation } from './animation/annotationAnimator';
import { ExportController, type ExportOptions } from './animation/exportController';
import type { AnimationSequence, CurvedRunAnnotation, GoalCelebration, PanelTab, PlayerRunAnimation, QueuedAnimation } from './types';
import { renderSceneToBlob } from './utils/sceneRenderer';
import { curvedRunControlPoint } from './utils/curveGeometry';
import { playKickSound, playGoalNetSound } from './utils/sound';

function AppContent() {
  const { state, dispatch } = useAppState();

  // Zoom/pan state (view-layer only, not in app reducer)
  const zoom = useZoom();

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

  // ── Annotation playback (Play Lines) ──
  const annotationControllerRef = useRef<PlaybackController | null>(null);

  // ── Per-player run animation (Space key) ──
  const playerRunAnimRef = useRef<PlayerRunAnimation | null>(null);
  const animationQueueRef = useRef<QueuedAnimation[]>([]);

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

  // Determine which playback ref PitchCanvas should read from
  const activePlaybackRef = state.annotationPlayback ? annotationControllerRef : controllerRef;

  const handlePlayLines = useCallback(() => {
    const seq = buildSequenceFromAnnotations(state.players, state.ball, state.annotations, 1000);
    if (!seq) return;

    dispatch({ type: 'START_ANNOTATION_PLAYBACK' });

    const onFrame = (status: import('./animation/playbackController').PlaybackStatus) => {
      if (status === 'idle') {
        dispatch({ type: 'STOP_ANNOTATION_PLAYBACK' });
        annotationControllerRef.current = null;
      }
    };

    const controller = new PlaybackController(seq, onFrame);
    annotationControllerRef.current = controller;
    controller.play();
  }, [state.players, state.ball, state.annotations, dispatch]);

  const handleStopAnnotationPlayback = useCallback(() => {
    annotationControllerRef.current?.stop();
    annotationControllerRef.current = null;
    dispatch({ type: 'STOP_ANNOTATION_PLAYBACK' });
  }, [dispatch]);

  // ── Export ──
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportSequence, setExportSequence] = useState<AnimationSequence | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const exportControllerRef = useRef<ExportController | null>(null);

  const handleOpenExport = useCallback((seq: AnimationSequence) => {
    setExportSequence(seq);
    setShowExportDialog(true);
    setExporting(false);
    setExportProgress(0);
  }, []);

  const handleExportLines = useCallback(() => {
    const seq = buildSequenceFromAnnotations(state.players, state.ball, state.annotations, 1000);
    if (!seq) return;
    handleOpenExport(seq);
  }, [state.players, state.ball, state.annotations, handleOpenExport]);

  const handleExportKeyframes = useCallback(() => {
    if (!state.animationSequence || state.animationSequence.keyframes.length < 2) return;
    handleOpenExport(state.animationSequence);
  }, [state.animationSequence, handleOpenExport]);

  const handleExport = useCallback(async (options: ExportOptions) => {
    if (!exportSequence) return;
    setExporting(true);
    setExportProgress(0);

    const controller = new ExportController(exportSequence, state, options);
    exportControllerRef.current = controller;

    try {
      const blob = await controller.exportWebM((progress) => {
        setExportProgress(progress);
      });

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exportSequence.name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'animation'}.webm`;
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

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't handle shortcuts while editing a player or annotation
      if (state.editingPlayerId || state.editingAnnotationId || state.pendingDeletePlayerId) return;

      if (e.key === 'Escape') {
        // Stop annotation playback if running
        if (state.annotationPlayback) {
          handleStopAnnotationPlayback();
          return;
        }
        if (state.animationMode && playbackStatus !== 'idle') {
          stop();
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

      // ── Per-player run/pass/dribble animation (Space outside animation mode) ──
      if ((e.key === ' ' || e.code === 'Space') && !state.animationMode && !state.annotationPlayback) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable) return;
        e.preventDefault();
        if (state.selectedPlayerId && !state.drawingInProgress && !playerRunAnimRef.current) {
          const selectedId = state.selectedPlayerId;

          // Gather ALL line annotations for auto-ordering
          const animatableTypes = ['running-line', 'curved-run', 'passing-line', 'dribble-line'] as const;
          const allLineAnns = state.annotations.filter(
            (a): a is LineAnnotation => (animatableTypes as readonly string[]).includes(a.type),
          );

          // Check if selected player has any annotations starting from them
          const playerAnns = allLineAnns.filter(a => a.startPlayerId === selectedId);
          if (playerAnns.length === 0) { return; }

          // Check for replay: all of the selected player's annotations are ghosted
          const nonGhostPlayerAnns = playerAnns.filter(a => !state.ghostAnnotationIds.includes(a.id));
          const ghostPlayerAnns = playerAnns.filter(a => state.ghostAnnotationIds.includes(a.id));
          const isReplay = nonGhostPlayerAnns.length === 0 && ghostPlayerAnns.length > 0;

          // Determine which annotations to animate:
          // - Non-ghost annotations (freshly drawn, not yet animated)
          // - In replay mode, include ghost annotations too
          const ghostIds = new Set(state.ghostAnnotationIds);
          const annsToAnimate = allLineAnns.filter(a =>
            isReplay ? true : !ghostIds.has(a.id)
          );

          if (annsToAnimate.length === 0) { return; }

          // Compute auto-ordering across annotations to animate
          const stepOrder = computeStepOrder(annsToAnimate);

          // Build ordered list: (annotation, step) pairs sorted by step
          type AnnWithStep = { ann: LineAnnotation; step: number };
          const ordered: AnnWithStep[] = annsToAnimate.map((ann, i) => ({
            ann,
            step: stepOrder ? stepOrder[i] : (ann.animStep ?? 1),
          }));
          ordered.sort((a, b) => a.step - b.step);

          // Build the animation queue from ordered annotations
          const queue: QueuedAnimation[] = [];
          for (const { ann } of ordered) {
            const animationType: 'run' | 'pass' | 'dribble' =
              ann.type === 'passing-line' ? 'pass'
              : ann.type === 'dribble-line' ? 'dribble'
              : 'run';

            queue.push({
              annotationId: ann.id,
              playerId: ann.startPlayerId ?? '',
              endPos: ann.end,
              curveDirection: ann.type === 'curved-run'
                ? ((ann as CurvedRunAnnotation).curveDirection ?? 'left')
                : undefined,
              durationMs: 1000,
              animationType,
              endPlayerId: ann.endPlayerId,
            });
          }

          if (queue.length === 0) { return; }

          // Handle ghost cleanup for the selected player
          const player = state.players.find(p => p.id === selectedId);
          if (!player) { return; }

          const existingGhost = state.ghostPlayers.find(g => g.playerId === player.id);
          if (isReplay && existingGhost) {
            dispatch({ type: 'RESET_RUN', playerId: player.id });
          } else if (existingGhost) {
            dispatch({ type: 'CLEAR_PLAYER_GHOSTS', playerId: player.id });
          }

          // Start the first animation from the queue
          const first = queue.shift()!;
          const startPlayer = isReplay && existingGhost && first.playerId === player.id
            ? { x: existingGhost.x, y: existingGhost.y }
            : { x: (state.players.find(p => p.id === first.playerId) ?? player).x,
                y: (state.players.find(p => p.id === first.playerId) ?? player).y };

          // Resolve endPos dynamically if targeting a player
          let firstEndPos = first.endPos;
          if (first.endPlayerId) {
            const targetPlayer = state.players.find(p => p.id === first.endPlayerId);
            if (targetPlayer) {
              firstEndPos = { x: targetPlayer.x, y: targetPlayer.y };
            }
          }

          // Compute control point for curved runs using actual start position
          const firstControlPoint = first.curveDirection
            ? curvedRunControlPoint(startPlayer, firstEndPos, first.curveDirection)
            : first.controlPoint;

          // For pass/dribble: snap ball to start player
          if (first.animationType === 'pass' || first.animationType === 'dribble') {
            dispatch({ type: 'MOVE_BALL', x: startPlayer.x, y: startPlayer.y });
          }
          if (first.animationType === 'pass') {
            playKickSound();
          }

          // Store remaining queue for PitchCanvas to consume
          animationQueueRef.current = queue;

          playerRunAnimRef.current = {
            playerId: first.playerId,
            annotationId: first.annotationId,
            startPos: startPlayer,
            endPos: firstEndPos,
            controlPoint: firstControlPoint,
            startTime: performance.now(),
            durationMs: first.durationMs,
            animationType: first.animationType,
            endPlayerId: first.endPlayerId,
          };
        }
        return;
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
      // Zoom presets
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
  }, [dispatch, state, playbackStatus, playbackIndex, play, pause, stop, seekToKeyframe, handleStopAnnotationPlayback, zoom]);

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
          onExportLines={handleExportLines}
          showPanel={showPanel}
          onTogglePanel={() => setShowPanel(p => !p)}
          helpActive={showPanel && panelTab === 'help'}
          onOpenHelp={() => {
            if (showPanel && panelTab === 'help') {
              setShowPanel(false);
            } else {
              setPanelTab('help');
              setShowPanel(true);
            }
          }}
        />
      </div>
      <div className="toolbar">
        <Toolbar />
      </div>
      <div className="canvas-area">
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
        />
      </div>
      <div className="statusbar">
        <StatusBar zoomLevel={zoom.zoomState.zoom} />
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
