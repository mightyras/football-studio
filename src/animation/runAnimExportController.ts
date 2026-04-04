/**
 * Deterministic export controller for run-animation sequences.
 *
 * Replays the Space-bar animation system (per-player runs, passes, dribbles)
 * frame-by-frame using virtual time. Produces a WebM or MP4 video.
 */
import type {
  AppState,
  QueuedAnimation,
  PlayerRunAnimation,
  RunAnimationOverlay,
  GhostPlayer,
  CurvedRunAnnotation,
  PassingLineAnnotation,
} from '../types';
import { computeRunFrame } from './playerRunAnimator';
import {
  computeStepOrder,
  computeOneTouchIndices,
  ONE_TOUCH_DURATION_MS,
  ANIM_DURATION_MS,
  PASS_LEAD_DELAY_MS,
  type LineAnnotation,
} from './annotationAnimator';
import { render } from '../canvas/renderPipeline';
import { computeTransform } from '../hooks/usePitchTransform';
import { curvedRunControlPoint, loftedArcControlPoint } from '../utils/curveGeometry';
import { findClosestGhost } from '../utils/ghostUtils';
import { MP4FrameEncoder, supportsMP4Export, type VideoFormat } from './mp4Encoder';
import type { ExportResult } from './exportController';

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

  /**
   * Core rendering loop shared by both WebM and MP4 export paths.
   * Calls `onFrame()` after each canvas render so the caller can capture it.
   */
  private async renderAllFrames(opts: {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    onFrame: () => Promise<void>;
    onProgress?: (progress: number) => void;
  }): Promise<void> {
    const { canvas, ctx, onFrame, onProgress } = opts;
    const { fps, width, height } = this.options;

    const queueResult = this.buildFullQueue();
    if (!queueResult) throw new Error('No animations to export');
    const { queue, allLineAnns } = queueResult;

    const totalBatches = this.countBatches([...queue]);

    const transform = computeTransform(
      width,
      height,
      this.baseState.pitchSettings.stadiumEnabled,
      this.baseState.pitchSettings.zoneOverlay,
    );

    const dtMs = 1000 / fps;

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

    const completedAnimIds = new Set<string>();
    let completedBatches = 0;

    const renderHold = async (holdState: AppState, frames: number) => {
      for (let i = 0; i < frames; i++) {
        if (this.cancelled) throw new Error('Export cancelled');
        ctx.clearRect(0, 0, width, height);
        render(ctx, transform, holdState, width, height);
        await onFrame();
        await new Promise((r) => setTimeout(r, 0));
      }
    };

    // Initial hold (0.5s)
    const holdFrames = Math.ceil(500 / dtMs);
    await renderHold(exportState, holdFrames);

    // Process each batch
    const finishedAnims: PlayerRunAnimation[] = [];

    while (queue.length > 0) {
      if (this.cancelled) throw new Error('Export cancelled');

      const nextStep = queue[0].step;
      const batch: QueuedAnimation[] = [];
      while (queue.length > 0 && queue[0].step === nextStep) {
        batch.push(queue.shift()!);
      }

      const anims = this.createBatchAnims(
        batch,
        exportState,
        allLineAnns,
        finishedAnims,
        0,
      );

      const batchDurationMs = Math.max(
        ...anims.map((a) => a.startTime + a.durationMs),
      );
      const batchTotalFrames = Math.ceil(batchDurationMs / dtMs) + 1;

      for (let f = 0; f <= batchTotalFrames; f++) {
        if (this.cancelled) throw new Error('Export cancelled');

        const virtualNow = f * dtMs;
        let renderState = { ...exportState };

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
              isLofted: anim.isLofted,
              ballElevation: frame.ballElevation,
            });
          }
        }

        ctx.clearRect(0, 0, width, height);
        render(ctx, transform, renderState, width, height, overlays);
        await onFrame();
        await new Promise((r) => setTimeout(r, 0));
      }

      exportState = this.applyBatchCompletion(exportState, anims);
      for (const anim of anims) {
        completedAnimIds.add(anim.annotationId);
      }

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
  }

  async exportWebM(
    onProgress?: (progress: number) => void,
  ): Promise<Blob> {
    const { width, height } = this.options;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    if (!canvas.captureStream) {
      throw new Error(
        'Your browser does not support canvas.captureStream(). Try Chrome or Firefox.',
      );
    }

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

    const track = stream.getVideoTracks()[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requestFrame = () => (track as any).requestFrame?.();

    return new Promise<Blob>((resolve, reject) => {
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        resolve(blob);
      };
      mediaRecorder.onerror = () => {
        reject(new Error('MediaRecorder error during export'));
      };

      mediaRecorder.start();

      this.renderAllFrames({
        canvas,
        ctx,
        onFrame: async () => { requestFrame(); },
        onProgress,
      }).then(() => {
        mediaRecorder.stop();
      }).catch((err) => {
        mediaRecorder.stop();
        reject(err);
      });
    });
  }

  async exportMP4(
    onProgress?: (progress: number) => void,
  ): Promise<Blob> {
    const { fps, width, height } = this.options;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const encoder = new MP4FrameEncoder(canvas, { width, height, fps });
    await encoder.start();

    let frameIndex = 0;
    try {
      await this.renderAllFrames({
        canvas,
        ctx,
        onFrame: async () => {
          await encoder.addFrame(frameIndex++);
        },
        onProgress,
      });
      return encoder.finalize();
    } catch (err) {
      encoder.dispose();
      throw err;
    }
  }

  /** Auto-detect best format: MP4 if supported, WebM fallback. */
  async export(onProgress?: (progress: number) => void): Promise<ExportResult> {
    if (await supportsMP4Export()) {
      try {
        const blob = await this.exportMP4(onProgress);
        return { blob, format: 'mp4' };
      } catch (err) {
        if (this.cancelled) throw err;
        console.warn('MP4 export failed, falling back to WebM:', err);
      }
    }
    const blob = await this.exportWebM(onProgress);
    return { blob, format: 'webm' };
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
      const isLofted = ann.type === 'passing-line' && (ann as PassingLineAnnotation).passType === 'lofted';
      const animationType: 'run' | 'pass' | 'dribble' =
        ann.type === 'passing-line'
          ? 'pass'
          : ann.type === 'dribble-line'
            ? 'dribble'
            : 'run';
      const isOneTouch = oneTouchIndices.has(idx);
      const baseDuration = isLofted ? ANIM_DURATION_MS.loftedPass : ANIM_DURATION_MS[animationType];
      queue.push({
        annotationId: ann.id,
        playerId: ann.startPlayerId ?? '',
        endPos: ann.end,
        curveDirection:
          ann.type === 'curved-run'
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

      // Compute control point for curved runs / lofted passes
      const controlPoint = item.curveDirection
        ? (item.isLofted
            ? loftedArcControlPoint(startPos, resolvedEndPos, item.curveDirection)
            : curvedRunControlPoint(startPos, resolvedEndPos, item.curveDirection))
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
        startTime: virtualStartTime + (item.startDelay ?? 0),
        durationMs: item.durationMs,
        animationType: item.animationType,
        endPlayerId: item.endPlayerId,
        isOneTouch: item.isOneTouch,
        isLofted: item.isLofted,
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
