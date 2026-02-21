/**
 * Deterministic export controller for run-animation sequences.
 *
 * Replays the Space-bar animation system (per-player runs, passes, dribbles)
 * frame-by-frame using virtual time. Produces a WebM video.
 */
import type {
  AppState,
  QueuedAnimation,
  PlayerRunAnimation,
  RunAnimationOverlay,
  GhostPlayer,
  CurvedRunAnnotation,
} from '../types';
import { computeRunFrame } from './playerRunAnimator';
import {
  computeStepOrder,
  computeOneTouchIndices,
  ONE_TOUCH_DURATION_MS,
  type LineAnnotation,
} from './annotationAnimator';
import { render } from '../canvas/renderPipeline';
import { computeTransform } from '../hooks/usePitchTransform';
import { curvedRunControlPoint } from '../utils/curveGeometry';
import { findClosestGhost } from '../utils/ghostUtils';

export interface RunAnimExportOptions {
  fps: number;
  width: number;
  height: number;
}

export class RunAnimExportController {
  private baseState: AppState;
  private options: RunAnimExportOptions;
  private cancelled = false;

  constructor(baseState: AppState, options: RunAnimExportOptions) {
    this.baseState = baseState;
    this.options = options;
  }

  cancel(): void {
    this.cancelled = true;
  }

  async exportWebM(
    onProgress?: (progress: number) => void,
  ): Promise<Blob> {
    const { fps, width, height } = this.options;

    // Build animation queue
    const queueResult = this.buildFullQueue();
    if (!queueResult) throw new Error('No animations to export');
    const { queue, allLineAnns } = queueResult;

    // Count total batches for progress reporting
    const totalBatches = this.countBatches([...queue]);

    // Create offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // Compute transform for export dimensions
    const transform = computeTransform(
      width,
      height,
      this.baseState.pitchSettings.stadiumEnabled,
      this.baseState.pitchSettings.zoneOverlay,
    );

    // Check captureStream support
    if (!canvas.captureStream) {
      throw new Error(
        'Your browser does not support canvas.captureStream(). Try Chrome or Firefox.',
      );
    }

    // Set up MediaRecorder
    const stream = canvas.captureStream(0);
    let mimeType = 'video/webm;codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm';
    }

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 5_000_000,
    });

    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const dtMs = 1000 / fps;

    // Clone state — export must not modify real state
    let exportState: AppState = {
      ...structuredClone(this.baseState),
      selectedPlayerId: null,
      hoveredPlayerId: null,
      hoveredNotchPlayerId: null,
      ballSelected: false,
      ballHovered: false,
      selectedAnnotationId: null,
      drawingInProgress: null,
    };

    // Track completed annotation IDs for ghost rendering
    const completedAnimIds = new Set<string>();
    let completedBatches = 0;

    return new Promise<Blob>((resolve, reject) => {
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        resolve(blob);
      };
      mediaRecorder.onerror = () => {
        reject(new Error('MediaRecorder error during export'));
      };

      mediaRecorder.start();

      const track = stream.getVideoTracks()[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const requestFrame = () => (track as any).requestFrame?.();

      // Render initial hold frames (~0.5s)
      const renderHold = async (holdState: AppState, frames: number) => {
        for (let i = 0; i < frames; i++) {
          if (this.cancelled) {
            mediaRecorder.stop();
            reject(new Error('Export cancelled'));
            return false;
          }
          ctx.clearRect(0, 0, width, height);
          render(ctx, transform, holdState, width, height);
          requestFrame();
          await new Promise((r) => setTimeout(r, 0));
        }
        return true;
      };

      const processQueue = async () => {
        // Initial hold (0.5s)
        const holdFrames = Math.ceil(500 / dtMs);
        if (!(await renderHold(exportState, holdFrames))) return;

        // Process each batch
        const finishedAnims: PlayerRunAnimation[] = [];

        while (queue.length > 0) {
          if (this.cancelled) {
            mediaRecorder.stop();
            reject(new Error('Export cancelled'));
            return;
          }

          // Pull next batch
          const nextStep = queue[0].step;
          const batch: QueuedAnimation[] = [];
          while (queue.length > 0 && queue[0].step === nextStep) {
            batch.push(queue.shift()!);
          }

          // Create PlayerRunAnimation[] with virtual startTime = 0
          const anims = this.createBatchAnims(
            batch,
            exportState,
            allLineAnns,
            finishedAnims,
            0,
          );

          // Determine batch duration
          const batchDurationMs = Math.max(
            ...anims.map((a) => a.durationMs),
          );
          const batchTotalFrames = Math.ceil(batchDurationMs / dtMs) + 1;

          // Render frames for this batch
          for (let f = 0; f <= batchTotalFrames; f++) {
            if (this.cancelled) {
              mediaRecorder.stop();
              reject(new Error('Export cancelled'));
              return;
            }

            const virtualNow = f * dtMs;
            let renderState = { ...exportState };

            // Apply completed annotation ghost IDs
            if (completedAnimIds.size > 0) {
              const extraGhostIds = [...completedAnimIds].filter(
                (id) => !renderState.ghostAnnotationIds.includes(id),
              );
              if (extraGhostIds.length > 0) {
                renderState = {
                  ...renderState,
                  ghostAnnotationIds: [
                    ...renderState.ghostAnnotationIds,
                    ...extraGhostIds,
                  ],
                };
              }
            }

            const overlays: RunAnimationOverlay[] = [];

            for (const anim of anims) {
              const frame = computeRunFrame(anim, virtualNow);
              const animType = anim.animationType ?? 'run';

              // Override player position (skip for pass)
              if (animType !== 'pass') {
                renderState = {
                  ...renderState,
                  players: renderState.players.map((p) =>
                    p.id === frame.playerId
                      ? { ...p, x: frame.x, y: frame.y, facing: frame.facing }
                      : p,
                  ),
                };
              }

              // Override ball position
              if (frame.ballX != null && frame.ballY != null) {
                renderState = {
                  ...renderState,
                  ball: {
                    ...renderState.ball,
                    x: frame.ballX,
                    y: frame.ballY,
                  },
                };
              }

              // Build overlay (ghost at start pos)
              const player = exportState.players.find(
                (p) => p.id === frame.playerId,
              );
              if (player) {
                overlays.push({
                  annotationId: anim.annotationId,
                  playerId: frame.playerId,
                  progress: frame.easedProgress,
                  ghostPlayer: {
                    playerId: player.id,
                    team: player.team,
                    number: player.number,
                    name: player.name,
                    x: anim.startPos.x,
                    y: anim.startPos.y,
                    facing: player.facing,
                    isGK: player.isGK,
                    createdAt: 0,
                  },
                  ballPos:
                    frame.ballX != null && frame.ballY != null
                      ? { x: frame.ballX, y: frame.ballY }
                      : undefined,
                  animationType: animType,
                });
              }
            }

            // Render frame
            ctx.clearRect(0, 0, width, height);
            render(ctx, transform, renderState, width, height, overlays);
            requestFrame();
            await new Promise((r) => setTimeout(r, 0));
          }

          // Batch finished — apply state changes (simulate EXECUTE_RUN)
          exportState = this.applyBatchCompletion(exportState, anims);
          for (const anim of anims) {
            completedAnimIds.add(anim.annotationId);
          }

          // Track finished anims for next batch start position resolution
          finishedAnims.length = 0;
          finishedAnims.push(...anims);

          completedBatches++;
          onProgress?.(Math.min(0.95, completedBatches / totalBatches));
        }

        // Final hold (1s)
        let finalState = { ...exportState };
        if (completedAnimIds.size > 0) {
          const extraGhostIds = [...completedAnimIds].filter(
            (id) => !finalState.ghostAnnotationIds.includes(id),
          );
          if (extraGhostIds.length > 0) {
            finalState = {
              ...finalState,
              ghostAnnotationIds: [
                ...finalState.ghostAnnotationIds,
                ...extraGhostIds,
              ],
            };
          }
        }
        await renderHold(finalState, Math.ceil(1000 / dtMs));

        onProgress?.(1);
        mediaRecorder.stop();
      };

      processQueue();
    });
  }

  // ── Queue building (mirrors buildAnimQueueForAll in App.tsx) ──

  private buildFullQueue(): {
    queue: QueuedAnimation[];
    allLineAnns: LineAnnotation[];
  } | null {
    const animatableTypes = [
      'running-line',
      'curved-run',
      'passing-line',
      'dribble-line',
    ] as const;
    const allLineAnns = this.baseState.annotations.filter(
      (a): a is LineAnnotation =>
        (animatableTypes as readonly string[]).includes(a.type),
    );
    const nonGhostAnns = allLineAnns.filter(
      (a) => !this.baseState.ghostAnnotationIds.includes(a.id),
    );
    if (nonGhostAnns.length === 0) return null;

    const stepOrder = computeStepOrder(nonGhostAnns);
    type AnnWithStep = { ann: LineAnnotation; step: number };
    const ordered: AnnWithStep[] = nonGhostAnns.map((ann, i) => ({
      ann,
      step: stepOrder ? stepOrder[i] : (ann.animStep ?? 1),
    }));
    ordered.sort((a, b) => a.step - b.step);

    const orderedAnns = ordered.map((o) => o.ann);
    const oneTouchIndices = computeOneTouchIndices(orderedAnns);

    const queue: QueuedAnimation[] = [];
    for (let idx = 0; idx < ordered.length; idx++) {
      const { ann } = ordered[idx];
      const animationType: 'run' | 'pass' | 'dribble' =
        ann.type === 'passing-line'
          ? 'pass'
          : ann.type === 'dribble-line'
            ? 'dribble'
            : 'run';
      const isOneTouch = oneTouchIndices.has(idx);
      queue.push({
        annotationId: ann.id,
        playerId: ann.startPlayerId ?? '',
        endPos: ann.end,
        curveDirection:
          ann.type === 'curved-run'
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
  }

  private countBatches(queue: QueuedAnimation[]): number {
    let count = 0;
    let i = 0;
    while (i < queue.length) {
      const step = queue[i].step;
      while (i < queue.length && queue[i].step === step) i++;
      count++;
    }
    return count;
  }

  // ── Batch animation creation (mirrors startAnimBatch in App.tsx) ──

  private createBatchAnims(
    batch: QueuedAnimation[],
    exportState: AppState,
    allLineAnns: LineAnnotation[],
    finishedAnims: PlayerRunAnimation[],
    virtualStartTime: number,
  ): PlayerRunAnimation[] {
    const anims: PlayerRunAnimation[] = [];

    for (const item of batch) {
      // Resolve start position
      let startPos: { x: number; y: number } | undefined;

      // Check just-finished animations (from previous batch)
      for (const fa of finishedAnims) {
        if (item.playerId === fa.playerId) {
          const faType = fa.animationType ?? 'run';
          startPos =
            faType === 'pass'
              ? { x: fa.startPos.x, y: fa.startPos.y }
              : { x: fa.endPos.x, y: fa.endPos.y };
          break;
        }
      }

      if (!startPos) {
        // Check if annotation starts from a preview ghost
        const annForItem = allLineAnns.find(
          (a) => a.id === item.annotationId,
        );
        const realP = exportState.players.find(
          (p) => p.id === item.playerId,
        );
        const pg = annForItem
          ? findClosestGhost(exportState.previewGhosts, item.playerId, annForItem.start)
          : undefined;
        if (annForItem && pg && realP) {
          const dxReal = annForItem.start.x - realP.x;
          const dyReal = annForItem.start.y - realP.y;
          const distReal = dxReal * dxReal + dyReal * dyReal;
          const dxGhost = annForItem.start.x - pg.x;
          const dyGhost = annForItem.start.y - pg.y;
          const distGhost = dxGhost * dxGhost + dyGhost * dyGhost;
          startPos =
            distGhost < distReal
              ? { x: pg.x, y: pg.y }
              : { x: realP.x, y: realP.y };
        } else if (realP) {
          startPos = { x: realP.x, y: realP.y };
        } else {
          startPos = { x: 0, y: 0 };
        }
      }

      // Resolve endPos dynamically if targeting a player
      let resolvedEndPos = item.endPos;
      if (item.endPlayerId) {
        // Check same-batch run for simultaneous run + pass
        const sameBatchRun = batch.find(
          (b) =>
            b.playerId === item.endPlayerId && b.animationType !== 'pass',
        );
        if (sameBatchRun) {
          resolvedEndPos = sameBatchRun.endPos;
        } else {
          // Check finished animations
          const finishedForTarget = finishedAnims.find(
            (fa) =>
              fa.playerId === item.endPlayerId &&
              (fa.animationType ?? 'run') !== 'pass',
          );
          if (finishedForTarget) {
            resolvedEndPos = {
              x: finishedForTarget.endPos.x,
              y: finishedForTarget.endPos.y,
            };
          } else {
            const targetPlayer = exportState.players.find(
              (p) => p.id === item.endPlayerId,
            );
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

      // For pass/dribble: snap ball to start position in state
      if (item.animationType === 'pass' || item.animationType === 'dribble') {
        exportState = {
          ...exportState,
          ball: { ...exportState.ball, x: startPos.x, y: startPos.y },
        };
      }

      anims.push({
        playerId: item.playerId,
        annotationId: item.annotationId,
        startPos,
        endPos: resolvedEndPos,
        controlPoint,
        startTime: virtualStartTime,
        durationMs: item.durationMs,
        animationType: item.animationType,
        endPlayerId: item.endPlayerId,
        isOneTouch: item.isOneTouch,
      });
    }

    return anims;
  }

  // ── Apply EXECUTE_RUN-equivalent state changes ──

  private applyBatchCompletion(
    state: AppState,
    anims: PlayerRunAnimation[],
  ): AppState {
    let result = { ...state };

    for (const anim of anims) {
      const animType = anim.animationType ?? 'run';
      const player = result.players.find((p) => p.id === anim.playerId);
      if (!player) continue;

      // Create ghost at start position
      const ghost: GhostPlayer = {
        playerId: player.id,
        team: player.team,
        number: player.number,
        name: player.name,
        x: anim.startPos.x,
        y: anim.startPos.y,
        facing: player.facing,
        isGK: player.isGK,
        createdAt: 0,
      };

      // Move player to endpoint (run/dribble) and compute facing
      if (animType !== 'pass') {
        const dx = anim.endPos.x - anim.startPos.x;
        const dy = anim.endPos.y - anim.startPos.y;
        const facing =
          dx === 0 && dy === 0 ? player.facing : Math.atan2(dy, dx);
        result = {
          ...result,
          players: result.players.map((p) =>
            p.id === anim.playerId
              ? { ...p, x: anim.endPos.x, y: anim.endPos.y, facing }
              : p,
          ),
        };
      }

      // Move ball (pass/dribble)
      if (animType === 'pass' || animType === 'dribble') {
        result = {
          ...result,
          ball: {
            ...result.ball,
            x: anim.endPos.x,
            y: anim.endPos.y,
          },
        };
      }

      // Add ghost player
      // Only remove preview ghost when the player physically moves (run/dribble).
      // A pass doesn't move the player, so their preview ghost for a future run must stay.
      const removePreviewGhost = animType !== 'pass';
      result = {
        ...result,
        ghostPlayers: [
          ...result.ghostPlayers.filter((g) => g.playerId !== anim.playerId),
          ghost,
        ],
        ghostAnnotationIds: result.ghostAnnotationIds.includes(
          anim.annotationId,
        )
          ? result.ghostAnnotationIds
          : [...result.ghostAnnotationIds, anim.annotationId],
        previewGhosts: removePreviewGhost
          ? result.previewGhosts.filter(
              (g) => g.sourceAnnotationId !== anim.annotationId,
            )
          : result.previewGhosts,
      };
    }

    return result;
  }
}
