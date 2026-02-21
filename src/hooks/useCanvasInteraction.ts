import { useCallback, useRef } from 'react';
import type { PitchTransform, AppState, Annotation, Player } from '../types';
import { type AppAction, defaultFacing } from '../state/appStateReducer';
import { findPlayerAtScreen, findPlayerNotchAtScreen, isBallAtScreen } from '../utils/hitTest';
import { getPlayerScreenRadius } from '../canvas/PlayerRenderer';
import { findAnnotationAtScreen } from '../utils/annotationHitTest';
import { getBenchBounds } from '../canvas/BenchRenderer';
import { PITCH } from '../constants/pitch';
import { computeMinStepForGhostStart } from '../utils/ghostUtils';

/** Clamp a world coordinate to the playable area (pitch + green buffer) */
const clampX = (x: number) => Math.max(-PITCH.padding, Math.min(PITCH.length + PITCH.padding, x));
const clampY = (y: number) => Math.max(-PITCH.padding, Math.min(PITCH.width + PITCH.padding, y));

export function useCanvasInteraction(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  transformRef: React.RefObject<PitchTransform | null>,
  stateRef: React.RefObject<AppState>,
  dispatch: React.Dispatch<AppAction>,
) {
  const isDragging = useRef(false);
  const lastAnnRef = useRef<{ x: number; y: number } | null>(null);
  const lastFormationRef = useRef<{ x: number; y: number } | null>(null);

  const getCanvasCoords = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    [canvasRef],
  );

  const onDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const transform = transformRef.current;
      const state = stateRef.current;
      if (!transform || !state) return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const screen = getCanvasCoords(e);

      // ── Draw tool double-click: close polygon / player-polygon / player-line ──
      if (state.activeTool === 'draw' && state.drawingInProgress) {
        const dp = state.drawingInProgress;

        if (dp.type === 'polygon' && dp.points.length >= 3) {
          const ann: Annotation = {
            id: `ann-${Date.now()}`,
            type: 'polygon',
            points: dp.points,
            fillColor: '#ffffff',
            fillOpacity: 0.15,
            strokeColor: '#ffffff',
          };
          dispatch({ type: 'ADD_ANNOTATION', annotation: ann });
          dispatch({ type: 'CANCEL_DRAWING' });
          return;
        }

        if (dp.type === 'player-polygon' && dp.playerIds.length >= 3) {
          const firstPlayer = state.players.find(p => p.id === dp.playerIds[0]);
          const teamColor = firstPlayer
            ? (firstPlayer.team === 'A' ? state.teamAColor : state.teamBColor)
            : '#ffffff';
          const ann: Annotation = {
            id: `ann-${Date.now()}`,
            type: 'player-polygon',
            playerIds: dp.playerIds,
            fillColor: teamColor,
            fillOpacity: 0.15,
            strokeColor: teamColor,
          };
          dispatch({ type: 'ADD_ANNOTATION', annotation: ann });
          dispatch({ type: 'CANCEL_DRAWING' });
          return;
        }

        if (dp.type === 'player-line' && dp.playerIds.length >= 2) {
          const ann: Annotation = {
            id: `ann-${Date.now()}`,
            type: 'player-line',
            playerIds: dp.playerIds,
            color: '#ffffff',
            lineWidth: 0.8,
          };
          dispatch({ type: 'ADD_ANNOTATION', annotation: ann });
          dispatch({ type: 'CANCEL_DRAWING' });
          return;
        }

        return; // Consume double-click in draw mode even if conditions not met
      }

      // ── Select tool double-click ──
      if (state.activeTool !== 'select') return;

      // Check for annotation double-click (text editing)
      const annHit = findAnnotationAtScreen(
        screen.x, screen.y, state.annotations, state.players, transform,
        state.ghostAnnotationIds, state.ghostPlayers, state.previewGhosts,
      );
      if (annHit && (annHit.type === 'text' || annHit.type === 'passing-line' || annHit.type === 'running-line' || annHit.type === 'curved-run' || annHit.type === 'dribble-line' || annHit.type === 'player-marking')) {
        dispatch({ type: 'START_EDITING_ANNOTATION', annotationId: annHit.id });
        return;
      }

      // Player double-click
      const hit = findPlayerAtScreen(screen.x, screen.y, state.players, transform, state.playerRadius);
      if (hit) {
        dispatch({ type: 'START_EDITING', playerId: hit.id });
      }
    },
    [canvasRef, transformRef, stateRef, dispatch, getCanvasCoords],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const transform = transformRef.current;
      const state = stateRef.current;
      if (!transform || !state) return;

      // Close edit popover if clicking elsewhere
      if (state.editingPlayerId) {
        const screen = getCanvasCoords(e);
        const hit = findPlayerAtScreen(screen.x, screen.y, state.players, transform, state.playerRadius);
        if (!hit || hit.id !== state.editingPlayerId) {
          dispatch({ type: 'STOP_EDITING' });
        }
        return;
      }

      // Close annotation edit popover if clicking elsewhere
      if (state.editingAnnotationId) {
        dispatch({ type: 'STOP_EDITING_ANNOTATION' });
        return;
      }

      const screen = getCanvasCoords(e);
      const world = transform.screenToWorld(screen.x, screen.y);
      const hit = findPlayerAtScreen(screen.x, screen.y, state.players, transform, state.playerRadius);

      // CMD+drag = rotate player facing
      if (e.metaKey && state.activeTool === 'select' && hit) {
        const angleToPointer = Math.atan2(world.y - hit.y, world.x - hit.x);
        dispatch({
          type: 'START_ROTATE',
          playerId: hit.id,
          startAngle: angleToPointer,
          startFacing: hit.facing,
        });
        isDragging.current = true;
        canvasRef.current?.setPointerCapture(e.pointerId);
        return;
      }

      // ── Draw tool ──
      if (state.activeTool === 'draw') {
        const subTool = state.drawSubTool;

        // --- Text sub-tool: place text annotation on click (anywhere) ---
        if (subTool === 'text') {
          const ann: Annotation = {
            id: `ann-${Date.now()}`,
            type: 'text',
            text: 'Text',
            position: { x: world.x, y: world.y },
            fontSize: 2.5,
            color: '#ffffff',
          };
          dispatch({ type: 'ADD_ANNOTATION', annotation: ann });
          dispatch({ type: 'SELECT_ANNOTATION', annotationId: ann.id });
          dispatch({ type: 'START_EDITING_ANNOTATION', annotationId: ann.id });
          return;
        }

        // --- Line sub-tools: passing, running, dribble ---
        if (subTool === 'passing-line' || subTool === 'running-line' || subTool === 'curved-run' || subTool === 'dribble-line') {
          if (state.drawingInProgress && state.drawingInProgress.type === 'line') {
            // Second click: commit the line
            const dp = state.drawingInProgress;
            // Snap end to player if near one — but not for running-line/dribble-line (destination only)
            const noEndSnap = dp.subTool === 'running-line' || dp.subTool === 'dribble-line';
            // Include preview ghosts as snap targets (real players first = higher priority)
            const endSnapTargets: Player[] = noEndSnap ? [] : [
              ...state.players,
              ...state.previewGhosts.map(g => ({ id: g.playerId, team: g.team, number: g.number, name: g.name, x: g.x, y: g.y, facing: g.facing, isGK: g.isGK } as Player)),
            ];
            const endSnapPlayer = !noEndSnap
              ? findPlayerAtScreen(screen.x, screen.y, endSnapTargets, transform, state.playerRadius)
              : null;
            const endPlayerId = (endSnapPlayer && endSnapPlayer.id !== dp.startPlayerId) ? endSnapPlayer.id : undefined;
            const endPoint = endPlayerId && endSnapPlayer ? { x: endSnapPlayer.x, y: endSnapPlayer.y } : { x: clampX(world.x), y: clampY(world.y) };

            // Compute default step: max existing step + 1
            const animatableTypes = ['running-line', 'curved-run', 'passing-line', 'dribble-line'];
            const existingLineAnns = state.annotations.filter(
              a => animatableTypes.includes(a.type) && !state.ghostAnnotationIds.includes(a.id)
            );
            const maxStep = existingLineAnns.reduce((max, a) => Math.max(max, ('animStep' in a ? (a.animStep ?? 1) : 1)), 0);
            let nextStep = maxStep + 1;

            // Guardrail: if drawing from a ghost, step must be > the incoming annotation's step
            if (dp.startFromGhost && dp.startPlayerId) {
              const minStep = computeMinStepForGhostStart(
                dp.startPlayerId, dp.start,
                state.annotations, state.previewGhosts,
              );
              nextStep = Math.max(nextStep, minStep);
            }

            const ann: Annotation = {
              id: `ann-${Date.now()}`,
              type: dp.subTool,
              start: dp.start,
              end: endPoint,
              startPlayerId: dp.startPlayerId,
              endPlayerId,
              color: '#ffffff',
              animStep: nextStep,
              ...(dp.subTool === 'curved-run' ? { curveDirection: e.shiftKey ? 'right' : 'left' } : {}),
            };
            dispatch({ type: 'ADD_ANNOTATION', annotation: ann });
            dispatch({ type: 'SELECT_ANNOTATION', annotationId: ann.id });
            dispatch({ type: 'CANCEL_DRAWING' });
          } else {
            // First click: start drawing — snap to player or preview ghost if near one
            let snapPlayer = findPlayerAtScreen(screen.x, screen.y, state.players, transform, state.playerRadius);
            let startFromGhost = false;
            // If no real player hit, check preview ghosts (future positions)
            if (!snapPlayer && state.previewGhosts.length > 0) {
              const ghostAsPlayers: Player[] = state.previewGhosts.map(g => ({
                id: g.playerId, team: g.team, number: g.number, name: g.name,
                x: g.x, y: g.y, facing: g.facing, isGK: g.isGK,
              }));
              snapPlayer = findPlayerAtScreen(screen.x, screen.y, ghostAsPlayers, transform, state.playerRadius);
              if (snapPlayer) startFromGhost = true;
            }
            // Running-line, curved-run, passing-line and dribble-line MUST start from a player (or ghost)
            if ((subTool === 'running-line' || subTool === 'curved-run' || subTool === 'passing-line' || subTool === 'dribble-line' || subTool === 'player-marking') && !snapPlayer) return;
            dispatch({
              type: 'START_DRAWING',
              drawing: {
                type: 'line',
                subTool,
                start: snapPlayer ? { x: snapPlayer.x, y: snapPlayer.y } : { x: clampX(world.x), y: clampY(world.y) },
                startPlayerId: snapPlayer?.id,
                startFromGhost,
                curveDirection: undefined,
              },
            });
          }
          return;
        }

        // --- Polygon sub-tool ---
        if (subTool === 'polygon') {
          if (state.drawingInProgress && state.drawingInProgress.type === 'polygon') {
            // Add vertex
            const dp = state.drawingInProgress;
            dispatch({
              type: 'UPDATE_DRAWING',
              drawing: {
                type: 'polygon',
                points: [...dp.points, { x: clampX(world.x), y: clampY(world.y) }],
              },
            });
          } else {
            // Start polygon
            dispatch({
              type: 'START_DRAWING',
              drawing: {
                type: 'polygon',
                points: [{ x: clampX(world.x), y: clampY(world.y) }],
              },
            });
          }
          return;
        }

        // --- Player polygon sub-tool ---
        if (subTool === 'player-polygon') {
          if (hit) {
            if (state.drawingInProgress && state.drawingInProgress.type === 'player-polygon') {
              // Add player (prevent duplicate)
              const dp = state.drawingInProgress;
              if (!dp.playerIds.includes(hit.id)) {
                dispatch({
                  type: 'UPDATE_DRAWING',
                  drawing: {
                    type: 'player-polygon',
                    playerIds: [...dp.playerIds, hit.id],
                  },
                });
              }
            } else {
              // Start player polygon
              dispatch({
                type: 'START_DRAWING',
                drawing: {
                  type: 'player-polygon',
                  playerIds: [hit.id],
                },
              });
            }
          }
          // Non-player clicks are ignored for player-polygon
          return;
        }

        // --- Ellipse sub-tool ---
        if (subTool === 'ellipse') {
          if (state.drawingInProgress && state.drawingInProgress.type === 'ellipse') {
            // Second click: commit the ellipse
            const dp = state.drawingInProgress;
            const edgeX = clampX(world.x);
            const edgeY = clampY(world.y);
            const radiusX = Math.abs(edgeY - dp.center.y); // screen-X ↔ world-Y
            const radiusY = Math.abs(edgeX - dp.center.x); // screen-Y ↔ world-X
            if (radiusX > 0.1 || radiusY > 0.1) {
              const ann: Annotation = {
                id: `ann-${Date.now()}`,
                type: 'ellipse',
                center: dp.center,
                radiusX: Math.max(radiusX, 0.5),
                radiusY: Math.max(radiusY, 0.5),
                fillColor: '#ffffff',
                fillOpacity: 0.15,
                strokeColor: '#ffffff',
              };
              dispatch({ type: 'ADD_ANNOTATION', annotation: ann });
            }
            dispatch({ type: 'CANCEL_DRAWING' });
          } else {
            // First click: set center
            dispatch({
              type: 'START_DRAWING',
              drawing: {
                type: 'ellipse',
                center: { x: clampX(world.x), y: clampY(world.y) },
              },
            });
          }
          return;
        }

        // --- Player marking sub-tool ---
        if (subTool === 'player-marking') {
          if (!hit) return; // must click on a player
          if (state.drawingInProgress && state.drawingInProgress.type === 'player-marking') {
            // Second click: commit
            const dp = state.drawingInProgress;
            if (hit.id === dp.markedPlayerId) return; // can't mark yourself
            const ann: Annotation = {
              id: `ann-${Date.now()}`,
              type: 'player-marking',
              markedPlayerId: dp.markedPlayerId,
              markingPlayerId: hit.id,
              fillColor: '#ef4444',
              fillOpacity: 0.20,
              strokeColor: '#dc2626',
            };
            dispatch({ type: 'ADD_ANNOTATION', annotation: ann });
            dispatch({ type: 'CANCEL_DRAWING' });
          } else {
            // First click: store marked player
            dispatch({
              type: 'START_DRAWING',
              drawing: { type: 'player-marking', markedPlayerId: hit.id },
            });
          }
          return;
        }

        // --- Player line sub-tool ---
        if (subTool === 'player-line') {
          if (hit) {
            if (state.drawingInProgress && state.drawingInProgress.type === 'player-line') {
              // Add player (prevent duplicate)
              const dp = state.drawingInProgress;
              if (!dp.playerIds.includes(hit.id)) {
                dispatch({
                  type: 'UPDATE_DRAWING',
                  drawing: {
                    type: 'player-line',
                    playerIds: [...dp.playerIds, hit.id],
                  },
                });
              }
            } else {
              // Start player line
              dispatch({
                type: 'START_DRAWING',
                drawing: {
                  type: 'player-line',
                  playerIds: [hit.id],
                },
              });
            }
          }
          // Non-player clicks are ignored for player-line
          return;
        }

        return;
      }

      // ── Select tool ──
      if (state.activeTool === 'select') {
        const ballHit = isBallAtScreen(screen.x, screen.y, state.ball, transform);

        // When both player and ball are under the cursor, pick the closer one
        // (ball wins ties — it renders on top and is smaller, so likely the target)
        let preferBall = false;
        if (hit && ballHit) {
          const playerPos = transform.worldToScreen(hit.x, hit.y);
          const ballPos = transform.worldToScreen(state.ball.x, state.ball.y);
          const dxP = screen.x - playerPos.x;
          const dyP = screen.y - playerPos.y;
          const dxB = screen.x - ballPos.x;
          const dyB = screen.y - ballPos.y;
          preferBall = (dxB * dxB + dyB * dyB) <= (dxP * dxP + dyP * dyP);
        }

        // Check if clicking on orientation notch (starts rotation without CMD)
        const notchHit = state.showOrientation
          ? findPlayerNotchAtScreen(screen.x, screen.y, state.players, transform, state.playerRadius, state.showOrientation)
          : null;

        if (ballHit && (!hit || preferBall)) {
          dispatch({
            type: 'START_DRAG_BALL',
            offsetX: world.x - state.ball.x,
            offsetY: world.y - state.ball.y,
          });
          isDragging.current = true;
          canvasRef.current?.setPointerCapture(e.pointerId);
        } else if (notchHit && !preferBall) {
          // Notch click → start rotation (no CMD needed)
          const angleToPointer = Math.atan2(world.y - notchHit.y, world.x - notchHit.x);
          dispatch({
            type: 'START_ROTATE',
            playerId: notchHit.id,
            startAngle: angleToPointer,
            startFacing: notchHit.facing,
          });
          isDragging.current = true;
          canvasRef.current?.setPointerCapture(e.pointerId);
        } else if (hit) {
          // When a player is hit, also check if a ghost annotation is under the cursor.
          // Ghost annotations get priority so users can select them even when the real
          // player (at the run endpoint) overlaps — but only when the click is on the
          // outer edge of the player hit area (not dead-center on the player).
          const ghostAnnHit = findAnnotationAtScreen(
            screen.x, screen.y, state.annotations, state.players, transform,
            state.ghostAnnotationIds, state.ghostPlayers, state.previewGhosts,
          );
          const hitPos = transform.worldToScreen(hit.x, hit.y);
          const dxH = screen.x - hitPos.x;
          const dyH = screen.y - hitPos.y;
          const distToPlayer = Math.sqrt(dxH * dxH + dyH * dyH);
          const playerVisualRadius = getPlayerScreenRadius(transform, state.playerRadius);
          const preferGhost = ghostAnnHit
            && state.ghostAnnotationIds.includes(ghostAnnHit.id)
            && distToPlayer > playerVisualRadius * 0.5;
          if (preferGhost) {
            dispatch({ type: 'SELECT_ANNOTATION', annotationId: ghostAnnHit!.id });
          } else {
            dispatch({
              type: 'START_DRAG',
              playerId: hit.id,
              offsetX: world.x - hit.x,
              offsetY: world.y - hit.y,
            });
            isDragging.current = true;
            canvasRef.current?.setPointerCapture(e.pointerId);
          }
        } else {
          // Check for annotation hit
          const annHit = findAnnotationAtScreen(
            screen.x, screen.y, state.annotations, state.players, transform,
            state.ghostAnnotationIds, state.ghostPlayers, state.previewGhosts,
          );
          if (annHit) {
            // Select and start dragging the annotation
            dispatch({ type: 'SELECT_ANNOTATION', annotationId: annHit.id });

            // Compute offset for dragging (use annotation's position/start as reference)
            let annRefX = 0;
            let annRefY = 0;
            if (annHit.type === 'text') {
              annRefX = annHit.position.x;
              annRefY = annHit.position.y;
            } else if (annHit.type === 'passing-line' || annHit.type === 'running-line' || annHit.type === 'curved-run' || annHit.type === 'dribble-line') {
              // Resolve start position from player if snapped
              if (annHit.startPlayerId) {
                const p = state.players.find(pl => pl.id === annHit.startPlayerId);
                annRefX = p ? p.x : annHit.start.x;
                annRefY = p ? p.y : annHit.start.y;
              } else {
                annRefX = annHit.start.x;
                annRefY = annHit.start.y;
              }
            } else if (annHit.type === 'polygon') {
              annRefX = annHit.points[0]?.x ?? 0;
              annRefY = annHit.points[0]?.y ?? 0;
            } else if (annHit.type === 'ellipse') {
              annRefX = annHit.center.x;
              annRefY = annHit.center.y;
            }
            // Player-connected annotations don't support dragging (they follow players)
            const isFullySnapped = (
              (annHit.type === 'passing-line' || annHit.type === 'running-line' || annHit.type === 'curved-run' || annHit.type === 'dribble-line') &&
              annHit.startPlayerId && annHit.endPlayerId
            );

            if (annHit.type !== 'player-polygon' && annHit.type !== 'player-line' && annHit.type !== 'player-marking' && !isFullySnapped) {
              lastAnnRef.current = { x: annRefX, y: annRefY };
              dispatch({
                type: 'START_DRAG_ANNOTATION',
                annotationId: annHit.id,
                offsetX: world.x - annRefX,
                offsetY: world.y - annRefY,
                initRefX: annRefX,
                initRefY: annRefY,
              });
              isDragging.current = true;
              canvasRef.current?.setPointerCapture(e.pointerId);
            }
          } else {
            // Check for bench click when stadium is enabled
            if (state.pitchSettings.stadiumEnabled) {
              const benchA = getBenchBounds('A');
              const benchB = getBenchBounds('B');
              if (
                world.x >= benchA.x0 && world.x <= benchA.x1 &&
                world.y >= benchA.y0 && world.y <= benchA.y1
              ) {
                dispatch({ type: 'SET_ACTIVE_BENCH', bench: state.activeBench === 'A' ? null : 'A' });
                return;
              }
              if (
                world.x >= benchB.x0 && world.x <= benchB.x1 &&
                world.y >= benchB.y0 && world.y <= benchB.y1
              ) {
                dispatch({ type: 'SET_ACTIVE_BENCH', bench: state.activeBench === 'B' ? null : 'B' });
                return;
              }
            }
            dispatch({ type: 'SELECT_PLAYER', playerId: null });
            dispatch({ type: 'SELECT_ANNOTATION', annotationId: null });
            if (state.activeBench) {
              dispatch({ type: 'SET_ACTIVE_BENCH', bench: null });
            }
          }
        }
      } else if (state.activeTool === 'add-player') {
        if (!hit && world.x >= 0 && world.x <= 105 && world.y >= 0 && world.y <= 68) {
          const teamPlayers = state.players.filter(p => p.team === state.activeTeam);
          const maxNum = teamPlayers.reduce((max, p) => Math.max(max, p.number), 0);
          dispatch({
            type: 'ADD_PLAYER',
            player: {
              id: `${state.activeTeam.toLowerCase()}-${Date.now()}`,
              team: state.activeTeam,
              number: maxNum + 1,
              name: '',
              x: world.x,
              y: world.y,
              facing: defaultFacing(state.activeTeam, state.teamADirection),
            },
          });
        }
      } else if (state.activeTool === 'delete') {
        if (hit) {
          dispatch({ type: 'SET_PENDING_DELETE_PLAYER', playerId: hit.id });
        } else {
          // Also allow deleting annotations in delete mode
          const annHit = findAnnotationAtScreen(
            screen.x, screen.y, state.annotations, state.players, transform,
            state.ghostAnnotationIds, state.ghostPlayers, state.previewGhosts,
          );
          if (annHit) {
            dispatch({ type: 'DELETE_ANNOTATION', annotationId: annHit.id });
          }
        }
      } else if (state.activeTool === 'formation-move') {
        // Click a player to select that team; click empty space to continue dragging the already-selected team
        const hitPlayer = findPlayerAtScreen(screen.x, screen.y, state.players, transform, state.playerRadius);
        const team = hitPlayer ? hitPlayer.team : state.formationMoveTeam;
        if (team) {
          if (hitPlayer && hitPlayer.team !== state.formationMoveTeam) {
            dispatch({ type: 'SET_FORMATION_MOVE_TEAM', team: hitPlayer.team });
          }
          dispatch({
            type: 'START_FORMATION_MOVE',
            team,
            anchorX: world.x,
            anchorY: world.y,
          });
          lastFormationRef.current = { x: world.x, y: world.y };
          isDragging.current = true;
          canvasRef.current?.setPointerCapture(e.pointerId);
        }
      }
    },
    [canvasRef, transformRef, stateRef, dispatch, getCanvasCoords],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const transform = transformRef.current;
      const state = stateRef.current;
      if (!transform || !state) return;

      const screen = getCanvasCoords(e);
      const world = transform.screenToWorld(screen.x, screen.y);

      dispatch({ type: 'SET_MOUSE_WORLD', x: world.x, y: world.y });

      if (isDragging.current && state.dragTarget) {
        if (state.dragTarget.type === 'rotate') {
          const rt = state.dragTarget;
          const rotPlayer = state.players.find(p => p.id === rt.playerId);
          if (rotPlayer) {
            const angleToPointer = Math.atan2(world.y - rotPlayer.y, world.x - rotPlayer.x);
            const delta = angleToPointer - rt.startAngle;
            dispatch({
              type: 'ROTATE_PLAYER',
              playerId: rotPlayer.id,
              facing: rt.startFacing + delta,
            });
          }
        } else if (state.dragTarget.type === 'player') {
          dispatch({
            type: 'MOVE_PLAYER',
            playerId: state.dragTarget.playerId,
            x: world.x - state.dragTarget.offsetX,
            y: world.y - state.dragTarget.offsetY,
          });
        } else if (state.dragTarget.type === 'annotation') {
          // Drag annotation: compute incremental delta from our locally-tracked ref position
          const dt = state.dragTarget;
          const last = lastAnnRef.current ?? { x: dt.initRefX, y: dt.initRefY };
          const newRefX = world.x - dt.offsetX;
          const newRefY = world.y - dt.offsetY;
          const dx = newRefX - last.x;
          const dy = newRefY - last.y;
          if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
            lastAnnRef.current = { x: newRefX, y: newRefY };
            dispatch({
              type: 'MOVE_ANNOTATION',
              annotationId: dt.annotationId,
              dx,
              dy,
            });
          }
        } else if (state.dragTarget.type === 'formation-move') {
          const last = lastFormationRef.current ?? { x: state.dragTarget.anchorX, y: state.dragTarget.anchorY };
          const dx = world.x - last.x;
          const dy = world.y - last.y;
          if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
            lastFormationRef.current = { x: world.x, y: world.y };
            dispatch({
              type: 'MOVE_FORMATION',
              team: state.dragTarget.team,
              dx,
              dy,
            });
          }
        } else {
          // Ball drag
          dispatch({
            type: 'MOVE_BALL',
            x: world.x - state.dragTarget.offsetX,
            y: world.y - state.dragTarget.offsetY,
          });
        }
      } else {
        const hit = findPlayerAtScreen(screen.x, screen.y, state.players, transform, state.playerRadius);
        const overBall = isBallAtScreen(screen.x, screen.y, state.ball, transform);

        // When both player and ball are under the cursor, prefer the closer one
        let hoverPreferBall = false;
        if (hit && overBall) {
          const playerPos = transform.worldToScreen(hit.x, hit.y);
          const ballPos = transform.worldToScreen(state.ball.x, state.ball.y);
          const dxP = screen.x - playerPos.x;
          const dyP = screen.y - playerPos.y;
          const dxB = screen.x - ballPos.x;
          const dyB = screen.y - ballPos.y;
          hoverPreferBall = (dxB * dxB + dyB * dyB) <= (dxP * dxP + dyP * dyP);
        }

        // Check notch hover (only in select mode with orientation shown)
        const notchHover = (state.activeTool === 'select' && state.showOrientation)
          ? findPlayerNotchAtScreen(screen.x, screen.y, state.players, transform, state.playerRadius, state.showOrientation)
          : null;
        const notchId = notchHover && !(overBall && hoverPreferBall) ? notchHover.id : null;
        if (notchId !== state.hoveredNotchPlayerId) {
          dispatch({ type: 'HOVER_NOTCH', playerId: notchId });
        }

        if (overBall && (!hit || hoverPreferBall)) {
          dispatch({ type: 'HOVER_BALL' });
        } else if (hit) {
          dispatch({ type: 'HOVER_PLAYER', playerId: hit.id });
        } else {
          dispatch({ type: 'HOVER_PLAYER', playerId: null });
        }

        // Update cursor
        const canvas = canvasRef.current;
        if (canvas) {
          if (state.activeTool === 'select') {
            const overSomething = hit || overBall;
            // Check for annotation hover
            let overAnnotation = false;
            if (!overSomething) {
              const annHit = findAnnotationAtScreen(
                screen.x, screen.y, state.annotations, state.players, transform,
                [], [], state.previewGhosts,
              );
              overAnnotation = annHit != null;
            }
            // Check if hovering over bench
            let overBench = false;
            if (state.pitchSettings.stadiumEnabled && !overSomething && !overAnnotation) {
              const benchA = getBenchBounds('A');
              const benchB = getBenchBounds('B');
              overBench =
                (world.x >= benchA.x0 && world.x <= benchA.x1 && world.y >= benchA.y0 && world.y <= benchA.y1) ||
                (world.x >= benchB.x0 && world.x <= benchB.x1 && world.y >= benchB.y0 && world.y <= benchB.y1);
            }
            canvas.style.cursor = notchId ? 'ew-resize' : overSomething ? 'grab' : overAnnotation ? 'grab' : overBench ? 'pointer' : 'default';
          } else if (state.activeTool === 'add-player') {
            canvas.style.cursor = 'crosshair';
          } else if (state.activeTool === 'delete') {
            canvas.style.cursor = hit ? 'pointer' : 'default';
          } else if (state.activeTool === 'formation-move') {
            canvas.style.cursor = hit ? 'pointer' : state.formationMoveTeam ? 'move' : 'default';
          } else if (state.activeTool === 'draw') {
            // For player-targeting sub-tools, show pointer when over a player
            const subTool = state.drawSubTool;
            if ((subTool === 'player-polygon' || subTool === 'player-line' || subTool === 'player-marking') && hit) {
              canvas.style.cursor = 'pointer';
            } else if (
              (subTool === 'passing-line' || subTool === 'running-line' || subTool === 'curved-run' || subTool === 'dribble-line')
              && (hit || (!state.drawingInProgress && state.previewGhosts.length > 0 && findPlayerAtScreen(
                screen.x, screen.y,
                state.previewGhosts.map(g => ({ id: g.playerId, team: g.team, number: g.number, name: g.name, x: g.x, y: g.y, facing: g.facing, isGK: g.isGK })),
                transform, state.playerRadius,
              )))
            ) {
              canvas.style.cursor = 'pointer'; // snap affordance (real player or preview ghost)
            } else {
              canvas.style.cursor = 'crosshair';
            }
          }
        }
      }

      if (isDragging.current && canvasRef.current) {
        canvasRef.current.style.cursor =
          state.dragTarget?.type === 'rotate' ? 'ew-resize'
          : state.dragTarget?.type === 'formation-move' ? 'move'
          : 'grabbing';
      }
    },
    [canvasRef, transformRef, stateRef, dispatch, getCanvasCoords],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (isDragging.current) {
        isDragging.current = false;
        lastAnnRef.current = null;
        lastFormationRef.current = null;
        dispatch({ type: 'END_DRAG' });
        canvasRef.current?.releasePointerCapture(e.pointerId);
      }
    },
    [canvasRef, dispatch],
  );

  return { onPointerDown, onPointerMove, onPointerUp, onDoubleClick };
}
