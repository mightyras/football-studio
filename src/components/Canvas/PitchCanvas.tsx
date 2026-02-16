import { useCallback, useEffect, useRef } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { usePitchTransform } from '../../hooks/usePitchTransform';
import { useCanvasInteraction } from '../../hooks/useCanvasInteraction';
import { useAppState } from '../../state/AppStateContext';
import { render } from '../../canvas/renderPipeline';
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
  playerRunAnimRef?: React.MutableRefObject<PlayerRunAnimation | null>;
  animationQueueRef?: React.MutableRefObject<QueuedAnimation[]>;
  goalCelebrationRef?: React.MutableRefObject<GoalCelebration | null>;
  onGoalScored?: (celebration: GoalCelebration) => void;
  zoom: ZoomProps;
}

export function PitchCanvas({ playbackRef, playerRunAnimRef, animationQueueRef, goalCelebrationRef, onGoalScored, zoom }: PitchCanvasProps) {
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
  transformRef.current = transform;
  stateRef.current = state;

  const { onPointerDown, onPointerMove, onPointerUp, onDoubleClick } =
    useCanvasInteraction(canvasRef, transformRef, stateRef, dispatch);

  // Track CMD and Shift keys for rotate mode and curve direction
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Meta') dispatch({ type: 'SET_CMD_HELD', held: true });
      if (e.key === 'Shift') dispatch({ type: 'SET_SHIFT_HELD', held: true });
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Meta') dispatch({ type: 'SET_CMD_HELD', held: false });
      if (e.key === 'Shift') dispatch({ type: 'SET_SHIFT_HELD', held: false });
    };
    // Clear on blur (CMD+Tab switches away without keyup)
    const handleBlur = () => {
      dispatch({ type: 'SET_CMD_HELD', held: false });
      dispatch({ type: 'SET_SHIFT_HELD', held: false });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
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

  // Wrap pointer handlers to intercept middle-click pan
  const wrappedPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.button === 1 && zoom.zoomState.zoom > 1) {
        e.preventDefault();
        const screen = getCanvasCoords(e);
        zoom.startPan(screen.x, screen.y);
        canvasRef.current?.setPointerCapture(e.pointerId);
        return;
      }
      onPointerDown(e);
    },
    [onPointerDown, zoom.zoomState.zoom, zoom.startPan, getCanvasCoords, canvasRef],
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

      // Hide annotations that finished in an earlier step of a queued sequence,
      // so the completed pass/run line disappears before the next step starts
      if (completedQueueAnimIds.current.size > 0) {
        const completedIds = completedQueueAnimIds.current;
        renderState = {
          ...renderState,
          annotations: renderState.annotations.filter(a => !completedIds.has(a.id)),
        };
      }

      // Per-player run animation tick
      const runAnim = playerRunAnimRef?.current;
      let runAnimOverlay: RunAnimationOverlay | undefined;

      if (runAnim) {
        const now = performance.now();
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
          renderState = {
            ...renderState,
            ball: {
              ...prevBall,
              x: runFrame.ballX,
              y: runFrame.ballY,
              rotationX: prevBall.rotationX + dx / prevBall.radius,
              rotationY: prevBall.rotationY + dy / prevBall.radius,
            },
          };
        }

        // Build transient visual overlay (ghost + line progress) for the render pipeline
        const player = baseState.players.find(p => p.id === runFrame.playerId);
        if (player) {
          runAnimOverlay = {
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
            },
            ballPos: (runFrame.ballX != null && runFrame.ballY != null)
              ? { x: runFrame.ballX, y: runFrame.ballY }
              : undefined,
            animationType: animType,
          };
        }

        if (runFrame.finished) {
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

          // Check animation queue for next animation
          const queue = animationQueueRef?.current;
          if (queue && queue.length > 0) {
            // Mark just-finished annotation as completed so it renders ghosted
            // even before React processes the EXECUTE_RUN dispatch
            completedQueueAnimIds.current.add(runAnim.annotationId);

            const next = queue.shift()!;

            // Resolve start position: use the player's actual position after the
            // previous animation. For same player: pass → stays at startPos,
            // run/dribble → moves to endPos. For different player: look up state.
            const currentState = stateRef.current;
            let startPos: { x: number; y: number };
            if (next.playerId === runAnim.playerId) {
              // Same player — position depends on animation type:
              // pass: player stayed at startPos; run/dribble: player moved to endPos
              startPos = animType === 'pass'
                ? { x: runAnim.startPos.x, y: runAnim.startPos.y }
                : { x: runAnim.endPos.x, y: runAnim.endPos.y };
            } else {
              const nextPlayer = currentState.players.find(p => p.id === next.playerId);
              startPos = nextPlayer
                ? { x: nextPlayer.x, y: nextPlayer.y }
                : { x: 0, y: 0 };
            }

            // Compute control point for curved runs
            const controlPoint = next.curveDirection
              ? curvedRunControlPoint(startPos, next.endPos, next.curveDirection)
              : next.controlPoint;

            // Resolve endPos dynamically: if the next animation targets a player
            // (endPlayerId), figure out where that player actually is RIGHT NOW.
            // We can't rely on currentState.players because EXECUTE_RUN was just
            // dispatched but React hasn't re-rendered yet — state is stale.
            // Instead: if the just-finished animation moved the target player,
            // use the animation's endPos as the player's current position.
            let resolvedEndPos = next.endPos;
            if (next.endPlayerId) {
              if (next.endPlayerId === runAnim.playerId && animType !== 'pass') {
                // The just-finished animation was a run/dribble for the target player —
                // they're now at runAnim.endPos (state hasn't caught up yet).
                resolvedEndPos = { x: runAnim.endPos.x, y: runAnim.endPos.y };
              } else {
                // Target player wasn't moved by the just-finished animation,
                // so their state position is still accurate.
                const targetPlayer = currentState.players.find(p => p.id === next.endPlayerId);
                if (targetPlayer) {
                  resolvedEndPos = { x: targetPlayer.x, y: targetPlayer.y };
                }
              }
            }

            // For pass/dribble: snap ball to start player
            if (next.animationType === 'pass' || next.animationType === 'dribble') {
              dispatch({ type: 'MOVE_BALL', x: startPos.x, y: startPos.y });
            }
            if (next.animationType === 'pass') {
              playKickSound();
            }

            // Recompute control point with resolved endpoint
            const resolvedControlPoint = next.curveDirection
              ? curvedRunControlPoint(startPos, resolvedEndPos, next.curveDirection)
              : controlPoint;

            // Start next animation
            playerRunAnimRef.current = {
              playerId: next.playerId,
              annotationId: next.annotationId,
              startPos,
              endPos: resolvedEndPos,
              controlPoint: resolvedControlPoint,
              startTime: performance.now(),
              durationMs: next.durationMs,
              animationType: next.animationType,
              endPlayerId: next.endPlayerId,
            };
          } else {
            // No more in queue — clear the animation ref and completed tracking
            completedQueueAnimIds.current.clear();
            playerRunAnimRef.current = null;
          }
        }
      }

      // Auto-clear expired goal celebration ref
      if (goalCelebrationRef?.current) {
        const celeb = goalCelebrationRef.current;
        if (performance.now() - celeb.startTime > celeb.durationMs) {
          goalCelebrationRef.current = null;
        }
      }

      render(ctx, transformRef.current!, renderState, size.width, size.height, runAnimOverlay, goalCelebrationRef?.current ?? undefined);
      ctx.restore();
      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, [canvasRef, size.width, size.height]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
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
