import { useCallback, useEffect, useRef } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { usePitchTransform } from '../../hooks/usePitchTransform';
import { useCanvasInteraction } from '../../hooks/useCanvasInteraction';
import { useAppState } from '../../state/AppStateContext';
import { render, type AnimContext } from '../../canvas/renderPipeline';
import { PlayerEditPopover } from './PlayerEditPopover';
import { AnnotationEditPopover } from './AnnotationEditPopover';
import { BenchPanel } from '../BenchPanel/BenchPanel';
import { ZoomControls } from './ZoomControls';
import type { PitchTransform, ZoomState, ZoomPreset, PitchRotation, PlayerRunAnimation, QueuedAnimation, RunAnimationOverlay, GoalCelebration } from '../../types';
import type { PlaybackController } from '../../animation/playbackController';
import { computeRunFrame } from '../../animation/playerRunAnimator';
import { isPointInGoal } from '../../utils/goalDetection';
import { curvedRunControlPoint } from '../../utils/curveGeometry';
import { playKickSound } from '../../utils/sound';
import { findStepBadgeAtScreen } from '../../utils/annotationHitTest';
import { findClosestGhost, computeMinStepForGhostStart } from '../../utils/ghostUtils';

interface ZoomProps {
  zoomState: ZoomState;
  activePreset: ZoomPreset;
  isPanning: React.RefObject<boolean>;
  rotation: PitchRotation;
  setPreset: (preset: ZoomPreset) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  handleWheel: (e: WheelEvent, screenToWorld: (sx: number, sy: number) => { x: number; y: number }, scale: number) => void;
  startPan: (screenX: number, screenY: number) => void;
  movePan: (screenX: number, screenY: number, scale: number) => void;
  endPan: () => void;
  rotateCW: () => void;
  rotateCCW: () => void;
}

interface PitchCanvasProps {
  playbackRef?: React.RefObject<PlaybackController | null>;
  playerRunAnimRef?: React.MutableRefObject<PlayerRunAnimation[]>;
  animationQueueRef?: React.MutableRefObject<QueuedAnimation[]>;
  stepQueueRef?: React.MutableRefObject<QueuedAnimation[]>;
  completedStepBatchesRef?: React.MutableRefObject<{ batch: QueuedAnimation[]; undoCount: number }[]>;
  goalCelebrationRef?: React.MutableRefObject<GoalCelebration | null>;
  onGoalScored?: (celebration: GoalCelebration) => void;
  zoom: ZoomProps;
}

export function PitchCanvas({ playbackRef, playerRunAnimRef, animationQueueRef, stepQueueRef, completedStepBatchesRef, goalCelebrationRef, onGoalScored, zoom }: PitchCanvasProps) {
  const { canvasRef, containerRef, size } = useCanvas();
  const { state, dispatch } = useAppState();
  const transform = usePitchTransform(
    size.width, size.height,
    state.pitchSettings.stadiumEnabled,
    state.pitchSettings.zoneOverlay,
    zoom.zoomState,
    zoom.rotation,
  );

  const transformRef = useRef<PitchTransform | null>(null);
  const stateRef = useRef(state);
  // Track annotation IDs completed during a queued animation sequence,
  // so they are hidden during subsequent steps (e.g. pass line drops when run starts).
  const completedQueueAnimIds = useRef<Set<string>>(new Set());
  // Track which badge is focused for number-key editing
  const focusedBadgeAnnId = useRef<string | null>(null);
  // Digit buffer for multi-digit step numbers (e.g. typing "12" quickly)
  const stepDigitBuffer = useRef<string>('');
  const stepDigitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  transformRef.current = transform;
  stateRef.current = state;

  const { onPointerDown, onPointerMove, onPointerUp, onDoubleClick } =
    useCanvasInteraction(canvasRef, transformRef, stateRef, dispatch);

  // Track CMD and Shift keys for rotate mode and curve direction,
  // and number keys for step badge editing
  useEffect(() => {
    const isLineAnnotation = (type: string) =>
      type === 'passing-line' || type === 'running-line' || type === 'curved-run' || type === 'dribble-line';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Meta') dispatch({ type: 'SET_CMD_HELD', held: true });
      if (e.key === 'Shift') dispatch({ type: 'SET_SHIFT_HELD', held: true });

      // Number keys 0-9: set step on selected line annotation (badge or just-drawn).
      // Accumulates digits with a 500ms timeout to support multi-digit steps (e.g. "12").
      if (e.key >= '0' && e.key <= '9') {
        const currentState = stateRef.current;
        const selId = focusedBadgeAnnId.current || currentState.selectedAnnotationId;
        if (selId) {
          const selAnn = currentState.annotations.find(a => a.id === selId);
          if (selAnn && isLineAnnotation(selAnn.type)) {
            e.preventDefault();

            // Don't allow leading zero
            if (e.key === '0' && stepDigitBuffer.current === '') return;

            // Append digit to buffer
            stepDigitBuffer.current += e.key;

            // Clear any pending commit timer
            if (stepDigitTimer.current) clearTimeout(stepDigitTimer.current);

            // Commit the buffered number after a short delay (allows typing multi-digit)
            const capturedSelId = selId;
            stepDigitTimer.current = setTimeout(() => {
              const step = parseInt(stepDigitBuffer.current, 10);
              stepDigitBuffer.current = '';
              stepDigitTimer.current = null;
              if (isNaN(step) || step < 1) return;

              // Guardrail: prevent setting a step lower than the incoming annotation's step
              const latestState = stateRef.current;
              const latestAnn = latestState.annotations.find(a => a.id === capturedSelId);
              if (latestAnn) {
                const lineAnn = latestAnn as { startPlayerId?: string; start: { x: number; y: number } };
                if (lineAnn.startPlayerId) {
                  const minStep = computeMinStepForGhostStart(
                    lineAnn.startPlayerId, lineAnn.start,
                    latestState.annotations, latestState.previewGhosts,
                  );
                  if (step < minStep) return; // reject too-low step
                }
              }
              dispatch({ type: 'EDIT_ANNOTATION', annotationId: capturedSelId, changes: { animStep: step } });
            }, 500);
            return;
          }
        }
      }
      // Escape: clear badge focus, selection, and digit buffer
      if (e.key === 'Escape' && focusedBadgeAnnId.current) {
        focusedBadgeAnnId.current = null;
        stepDigitBuffer.current = '';
        if (stepDigitTimer.current) { clearTimeout(stepDigitTimer.current); stepDigitTimer.current = null; }
        dispatch({ type: 'SELECT_ANNOTATION', annotationId: null });
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Meta') dispatch({ type: 'SET_CMD_HELD', held: false });
      if (e.key === 'Shift') dispatch({ type: 'SET_SHIFT_HELD', held: false });
    };
    // Clear on blur (CMD+Tab switches away without keyup)
    const handleBlur = () => {
      dispatch({ type: 'SET_CMD_HELD', held: false });
      dispatch({ type: 'SET_SHIFT_HELD', held: false });
      focusedBadgeAnnId.current = null;
      // Clear digit buffer on blur
      stepDigitBuffer.current = '';
      if (stepDigitTimer.current) { clearTimeout(stepDigitTimer.current); stepDigitTimer.current = null; }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      // Clean up digit timer on unmount
      if (stepDigitTimer.current) { clearTimeout(stepDigitTimer.current); stepDigitTimer.current = null; }
    };
  }, [dispatch]);

  // Wheel zoom listener (passive: false to allow preventDefault)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      if (!transformRef.current) return;
      zoom.handleWheel(e, transformRef.current.screenToWorld, transformRef.current.scale);
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [canvasRef, zoom.handleWheel]);

  // Helper to get canvas-relative coordinates
  const getCanvasCoords = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },
    [canvasRef],
  );

  // Wrap pointer handlers to intercept middle-click pan and badge clicks
  const wrappedPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.button === 1 && zoom.zoomState.zoom > 1) {
        e.preventDefault();
        const screen = getCanvasCoords(e);
        zoom.startPan(screen.x, screen.y);
        canvasRef.current?.setPointerCapture(e.pointerId);
        return;
      }
      // Check if clicking on a step badge — if so, focus it for number-key editing
      if (e.button === 0 && transformRef.current && stateRef.current.showStepNumbers) {
        const screen = getCanvasCoords(e);
        const annId = findStepBadgeAtScreen(screen.x, screen.y, stateRef.current.annotations, stateRef.current.players, transformRef.current, stateRef.current.previewGhosts);
        if (annId) {
          focusedBadgeAnnId.current = annId;
          dispatch({ type: 'SELECT_ANNOTATION', annotationId: annId });
          return; // consumed — don't pass through to normal interaction
        }
      }
      // Clear badge focus when clicking elsewhere
      focusedBadgeAnnId.current = null;
      onPointerDown(e);
    },
    [onPointerDown, zoom.zoomState.zoom, zoom.startPan, getCanvasCoords, canvasRef, dispatch],
  );

  const wrappedPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (zoom.isPanning.current) {
        const screen = getCanvasCoords(e);
        zoom.movePan(screen.x, screen.y, transformRef.current?.scale ?? 1);
        return;
      }
      onPointerMove(e);
    },
    [onPointerMove, zoom.isPanning, zoom.movePan, getCanvasCoords],
  );

  const wrappedPointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (zoom.isPanning.current) {
        zoom.endPan();
        canvasRef.current?.releasePointerCapture(e.pointerId);
        return;
      }
      onPointerUp(e);
    },
    [onPointerUp, zoom.isPanning, zoom.endPan, canvasRef],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0 || size.height === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const frame = () => {
      const dpr = window.devicePixelRatio || 1;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const pb = playbackRef?.current;
      const baseState = stateRef.current;

      // If playback active, overlay interpolated state
      let renderState = (pb && pb.status !== 'idle')
        ? {
            ...baseState,
            players: pb.interpolatedPlayers,
            ball: pb.interpolatedBall,
            annotations: pb.interpolatedAnnotations,
            // Clear transient UI during playback
            selectedPlayerId: null,
            hoveredPlayerId: null,
            hoveredNotchPlayerId: null,
            ballSelected: false,
            ballHovered: false,
            selectedAnnotationId: null,
            drawingInProgress: null,
          }
        : baseState;

      // Annotations that finished in an earlier step of a queued sequence:
      // treat them as ghost annotations so they render at ghost opacity
      // instead of full opacity while the remaining queue plays out.
      // (EXECUTE_RUN adds them to ghostAnnotationIds, but React may not
      // have processed the dispatch yet on the very next frame.)
      if (completedQueueAnimIds.current.size > 0) {
        const completedIds = completedQueueAnimIds.current;
        const extraGhostIds = [...completedIds].filter(id => !renderState.ghostAnnotationIds.includes(id));
        if (extraGhostIds.length > 0) {
          renderState = {
            ...renderState,
            ghostAnnotationIds: [...renderState.ghostAnnotationIds, ...extraGhostIds],
          };
        }
      }

      // Timestamp for this frame (used for animation, ghost fading, etc.)
      const now = performance.now();

      // Per-player run animation tick — process all concurrent animations
      const activeAnims = playerRunAnimRef?.current ?? [];
      const runAnimOverlays: RunAnimationOverlay[] = [];
      const finishedAnims: PlayerRunAnimation[] = [];

      for (const runAnim of activeAnims) {
        const runFrame = computeRunFrame(runAnim, now);
        const animType = runAnim.animationType ?? 'run';

        // Override this player's position in renderState (skip for pass — player stays put)
        if (animType !== 'pass') {
          renderState = {
            ...renderState,
            players: renderState.players.map(p =>
              p.id === runFrame.playerId
                ? { ...p, x: runFrame.x, y: runFrame.y, facing: runFrame.facing }
                : p
            ),
          };
        }

        // Override ball position during pass/dribble animations, with rolling
        if (runFrame.ballX != null && runFrame.ballY != null) {
          const prevBall = renderState.ball;
          const dx = runFrame.ballX - prevBall.x;
          const dy = runFrame.ballY - prevBall.y;
          // Lofted passes: freeze rotation while airborne, resume rolling on ground contact (bounces)
          const isAirborne = runAnim.isLofted && runFrame.ballElevation != null && runFrame.ballElevation > 0.01;
          const rotX = isAirborne ? prevBall.rotationX : prevBall.rotationX + dx / prevBall.radius;
          const rotY = isAirborne ? prevBall.rotationY : prevBall.rotationY + dy / prevBall.radius;
          renderState = {
            ...renderState,
            ball: {
              ...prevBall,
              x: runFrame.ballX,
              y: runFrame.ballY,
              rotationX: rotX,
              rotationY: rotY,
            },
          };
        }

        // Build transient visual overlay (ghost + line progress) for the render pipeline
        const player = baseState.players.find(p => p.id === runFrame.playerId);
        if (player) {
          runAnimOverlays.push({
            annotationId: runAnim.annotationId,
            playerId: runFrame.playerId,
            progress: runFrame.easedProgress,
            ghostPlayer: {
              playerId: player.id,
              team: player.team,
              number: player.number,
              name: player.name,
              x: runAnim.startPos.x,
              y: runAnim.startPos.y,
              facing: player.facing,
              isGK: player.isGK,
              createdAt: 0, // transient — never fades during animation
            },
            ballPos: (runFrame.ballX != null && runFrame.ballY != null)
              ? { x: runFrame.ballX, y: runFrame.ballY }
              : undefined,
            animationType: animType,
            isLofted: runAnim.isLofted,
            ballElevation: runFrame.ballElevation,
          });
        }

        if (runFrame.finished) {
          finishedAnims.push(runAnim);

          // Dispatch state update — move player/ball to endpoint and create ghost
          if (player) {
            dispatch({
              type: 'EXECUTE_RUN',
              playerId: runFrame.playerId,
              x: runAnim.endPos.x,
              y: runAnim.endPos.y,
              facing: runFrame.facing,
              ghost: {
                playerId: player.id,
                team: player.team,
                number: player.number,
                name: player.name,
                x: runAnim.startPos.x,
                y: runAnim.startPos.y,
                facing: player.facing,
                isGK: player.isGK,
                createdAt: 0, // stamped when animation queue empties
              },
              annotationId: runAnim.annotationId,
              ...(animType === 'pass' || animType === 'dribble' ? {
                ballX: runAnim.endPos.x,
                ballY: runAnim.endPos.y,
                animationType: animType,
              } : {}),
            });

            // Goal detection for pass animations
            if (animType === 'pass') {
              const goalResult = isPointInGoal(runAnim.endPos.x, runAnim.endPos.y);
              if (goalResult.inGoal && goalResult.side) {
                const currentState = stateRef.current;
                const teamName = player.team === 'A' ? currentState.teamAName : currentState.teamBName;
                const teamColor = player.team === 'A' ? currentState.teamAColor : currentState.teamBColor;

                const celebration: GoalCelebration = {
                  startTime: performance.now(),
                  impactPoint: { x: runAnim.endPos.x, y: runAnim.endPos.y },
                  side: goalResult.side,
                  durationMs: 1500,
                  scorerTeam: player.team,
                  scorerNumber: player.number,
                  scorerName: player.name,
                  teamName,
                  teamColor,
                };

                if (goalCelebrationRef) {
                  goalCelebrationRef.current = celebration;
                }
                onGoalScored?.(celebration);
              }
            }
          }
        }
      }

      // When ALL concurrent animations in the current step are done, advance to next step
      if (finishedAnims.length > 0 && finishedAnims.length === activeAnims.length) {
        // Mark all finished annotations as completed for ghost rendering
        for (const fa of finishedAnims) {
          completedQueueAnimIds.current.add(fa.annotationId);
        }

        // Stamp completed-step ghosts immediately so they start fading now
        // (only stamps ghosts with createdAt === 0, so won't re-stamp already-fading ones)
        dispatch({ type: 'STAMP_GHOST_FADE_START', time: performance.now() });

        // Check animation queue for next batch (same step = simultaneous)
        const queue = animationQueueRef?.current;
        if (queue && queue.length > 0) {
          const nextStep = queue[0].step;
          const batch: QueuedAnimation[] = [];
          while (queue.length > 0 && queue[0].step === nextStep) {
            batch.push(queue.shift()!);
          }

          const currentState = stateRef.current;
          const nowMs = performance.now();
          const nextAnims: PlayerRunAnimation[] = [];
          let didKick = false;

          for (const next of batch) {
            // Resolve start position: check just-finished animations first (state is stale)
            let startPos: { x: number; y: number } | undefined;
            for (const fa of finishedAnims) {
              if (next.playerId === fa.playerId) {
                const faType = fa.animationType ?? 'run';
                startPos = faType === 'pass'
                  ? { x: fa.startPos.x, y: fa.startPos.y }
                  : { x: fa.endPos.x, y: fa.endPos.y };
                break;
              }
            }
            if (!startPos) {
              // Check if the annotation starts from a preview ghost (future position)
              const annForNext = currentState.annotations.find(a => a.id === next.annotationId);
              const nextPlayer = currentState.players.find(p => p.id === next.playerId);
              const lineAnnStart = annForNext && 'start' in annForNext ? (annForNext as { start: { x: number; y: number } }).start : undefined;
              const pg = lineAnnStart ? findClosestGhost(currentState.previewGhosts, next.playerId, lineAnnStart) : undefined;
              if (annForNext && pg && nextPlayer && 'start' in annForNext) {
                const lineAnn = annForNext as { start: { x: number; y: number } };
                const dxReal = lineAnn.start.x - nextPlayer.x;
                const dyReal = lineAnn.start.y - nextPlayer.y;
                const distReal = dxReal * dxReal + dyReal * dyReal;
                const dxGhost = lineAnn.start.x - pg.x;
                const dyGhost = lineAnn.start.y - pg.y;
                const distGhost = dxGhost * dxGhost + dyGhost * dyGhost;
                startPos = distGhost < distReal ? { x: pg.x, y: pg.y } : { x: nextPlayer.x, y: nextPlayer.y };
              } else {
                startPos = nextPlayer
                  ? { x: nextPlayer.x, y: nextPlayer.y }
                  : { x: 0, y: 0 };
              }
            }

            // Resolve endPos dynamically
            let resolvedEndPos = next.endPos;
            if (next.endPlayerId) {
              // Check if the target player has a same-batch run (simultaneous run + pass)
              const sameBatchRun = batch.find(
                b => b.playerId === next.endPlayerId && b.animationType !== 'pass'
              );
              if (sameBatchRun) {
                // Pass should go to where the player is running TO, not where they are now
                resolvedEndPos = sameBatchRun.endPos;
              } else {
                // Check if the target player was moved by a just-finished animation
                const finishedForTarget = finishedAnims.find(
                  fa => fa.playerId === next.endPlayerId && (fa.animationType ?? 'run') !== 'pass'
                );
                if (finishedForTarget) {
                  resolvedEndPos = { x: finishedForTarget.endPos.x, y: finishedForTarget.endPos.y };
                } else {
                  const targetPlayer = currentState.players.find(p => p.id === next.endPlayerId);
                  if (targetPlayer) {
                    resolvedEndPos = { x: targetPlayer.x, y: targetPlayer.y };
                  }
                }
              }
            }

            // Compute control point for curved runs
            const controlPoint = next.curveDirection
              ? curvedRunControlPoint(startPos, resolvedEndPos, next.curveDirection)
              : next.controlPoint;

            // For pass/dribble: snap ball to start player
            if (next.animationType === 'pass' || next.animationType === 'dribble') {
              dispatch({ type: 'MOVE_BALL', x: startPos.x, y: startPos.y });
            }
            if (next.animationType === 'pass' && !didKick) {
              playKickSound();
              didKick = true;
            }

            nextAnims.push({
              playerId: next.playerId,
              annotationId: next.annotationId,
              startPos,
              endPos: resolvedEndPos,
              controlPoint,
              startTime: nowMs + (next.startDelay ?? 0),
              durationMs: next.durationMs,
              animationType: next.animationType,
              endPlayerId: next.endPlayerId,
              isOneTouch: next.isOneTouch,
            });
          }

          if (playerRunAnimRef) playerRunAnimRef.current = nextAnims;
        } else {
          // No more in queue — clear the animation ref
          if (playerRunAnimRef) playerRunAnimRef.current = [];
          // Clear completed tracking (annotations are now in ghostAnnotationIds)
          completedQueueAnimIds.current.clear();
        }
      } else if (finishedAnims.length > 0) {
        // Some finished but not all — remove finished ones, keep remaining active
        if (playerRunAnimRef) playerRunAnimRef.current = activeAnims.filter(a => !finishedAnims.includes(a));
        for (const fa of finishedAnims) {
          completedQueueAnimIds.current.add(fa.annotationId);
        }
      }

      // Auto-clear expired goal celebration ref
      if (goalCelebrationRef?.current) {
        const celeb = goalCelebrationRef.current;
        if (performance.now() - celeb.startTime > celeb.durationMs) {
          goalCelebrationRef.current = null;
        }
      }


      // Build animation context for render pipeline.
      // isAnimActive is true when animations are running, auto-advancing, or mid step-through.
      // completedStepBatchesRef tracks executed steps — it's populated from the first step
      // and cleared when the session ends (Escape, all steps done, or new Space play).
      const hasAutoQueue = (animationQueueRef?.current?.length ?? 0) > 0;
      const isInSteppingSession = (completedStepBatchesRef?.current?.length ?? 0) > 0;
      const isAnimActive = activeAnims.length > 0 || hasAutoQueue || isInSteppingSession;
      const nextStepAnnIds = new Set<string>();
      // Check auto-play queue
      const autoQueue = animationQueueRef?.current;
      if (autoQueue && autoQueue.length > 0) {
        const nextStep = autoQueue[0].step;
        for (const q of autoQueue) {
          if (q.step === nextStep) nextStepAnnIds.add(q.annotationId);
          else break;
        }
      }
      // Check step-through queue
      const stepQueue = stepQueueRef?.current;
      if (stepQueue && stepQueue.length > 0) {
        const nextStep = stepQueue[0].step;
        for (const q of stepQueue) {
          if (q.step === nextStep) nextStepAnnIds.add(q.annotationId);
          else break;
        }
      }
      // If a next-step annotation was previously in completedQueueAnimIds, remove it.
      // This handles backward stepping (Left Arrow / CMD+Z) where UNDO restores the
      // annotation but completedQueueAnimIds still had it marked as completed.
      for (const id of nextStepAnnIds) {
        completedQueueAnimIds.current.delete(id);
      }
      const animContext: AnimContext = {
        isActive: isAnimActive,
        nextStepAnnotationIds: nextStepAnnIds.size > 0 ? nextStepAnnIds : undefined,
      };
      render(ctx, transformRef.current!, renderState, size.width, size.height, runAnimOverlays, goalCelebrationRef?.current ?? undefined, now, animContext);
      ctx.restore();

      // Auto-cleanup fully faded ghosts (0.2s hold + 0.8s fade = 1.0s total)
      const GHOST_TOTAL_MS = 1000;
      for (const ghost of stateRef.current.ghostPlayers) {
        if (ghost.createdAt > 0 && now - ghost.createdAt > GHOST_TOTAL_MS) {
          dispatch({ type: 'CLEAR_PLAYER_GHOSTS', playerId: ghost.playerId });
        }
      }

      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, [canvasRef, size.width, size.height]);

  return (
    <div
      ref={containerRef}
      data-tour="pitch"
      style={{
        width: '100%',
        flex: 1,
        minHeight: 0,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={wrappedPointerDown}
        onPointerMove={wrappedPointerMove}
        onPointerUp={wrappedPointerUp}
        onDoubleClick={onDoubleClick}
        onContextMenu={e => e.preventDefault()}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          touchAction: 'none',
        }}
      />
      {state.editingPlayerId && (
        <PlayerEditPopover transform={transform} />
      )}
      {state.editingAnnotationId && (
        <AnnotationEditPopover transform={transform} />
      )}
      {state.pitchSettings.stadiumEnabled && state.activeBench && (
        <BenchPanel />
      )}
      <ZoomControls
        zoomLevel={zoom.zoomState.zoom}
        activePreset={zoom.activePreset}
        rotation={zoom.rotation}
        onSetPreset={zoom.setPreset}
        onZoomIn={zoom.zoomIn}
        onZoomOut={zoom.zoomOut}
        onReset={zoom.resetZoom}
        onRotateCW={zoom.rotateCW}
      />
    </div>
  );
}
