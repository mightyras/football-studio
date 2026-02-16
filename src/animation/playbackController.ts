import type { Annotation, AnimationSequence, BallState, Player } from '../types';
import { interpolateKeyframes } from './interpolationEngine';

export type PlaybackStatus = 'idle' | 'playing' | 'paused';

export type PlaybackOnFrame = (status: PlaybackStatus, keyframeIndex: number, progress: number) => void;

/**
 * Imperative playback controller that drives animation via rAF.
 * Writes interpolated state to public fields that the render loop reads directly.
 * This avoids React re-renders at 60fps.
 */
export class PlaybackController {
  // ── Public read-only state (consumed by render loop) ──
  status: PlaybackStatus = 'idle';
  keyframeIndex: number = 0;
  progress: number = 0; // [0,1] within current transition

  interpolatedPlayers: Player[] = [];
  interpolatedBall: BallState = { x: 52.5, y: 34, radius: 1, rotationX: 0, rotationY: 0 };
  interpolatedAnnotations: Annotation[] = [];

  // ── Private ──
  private sequence: AnimationSequence;
  private speedMultiplier: number = 1;
  private onFrame: PlaybackOnFrame | null = null;
  private animId: number | null = null;
  private lastTimestamp: number = 0;
  private elapsedInTransition: number = 0;

  constructor(sequence: AnimationSequence, onFrame?: PlaybackOnFrame) {
    this.sequence = sequence;
    this.speedMultiplier = sequence.speedMultiplier;
    this.onFrame = onFrame ?? null;

    // Initialize with first keyframe
    if (sequence.keyframes.length > 0) {
      const kf = sequence.keyframes[0];
      this.interpolatedPlayers = kf.players;
      this.interpolatedBall = kf.ball;
      this.interpolatedAnnotations = kf.annotations;
    }
  }

  updateSequence(sequence: AnimationSequence) {
    this.sequence = sequence;
    this.speedMultiplier = sequence.speedMultiplier;
  }

  play() {
    if (this.sequence.keyframes.length < 2) {
      // Single frame — just show it
      if (this.sequence.keyframes.length === 1) {
        const kf = this.sequence.keyframes[0];
        this.interpolatedPlayers = kf.players;
        this.interpolatedBall = kf.ball;
        this.interpolatedAnnotations = kf.annotations;
      }
      return;
    }

    if (this.status === 'paused') {
      // Resume
      this.status = 'playing';
      this.lastTimestamp = performance.now();
      this.scheduleFrame();
      this.notifyFrame();
      return;
    }

    // Start from current position
    this.status = 'playing';
    this.lastTimestamp = performance.now();
    this.elapsedInTransition = 0;

    // If at the end, restart from beginning
    if (this.keyframeIndex >= this.sequence.keyframes.length - 1) {
      this.keyframeIndex = 0;
      this.progress = 0;
    }

    this.scheduleFrame();
    this.notifyFrame();
  }

  pause() {
    if (this.status !== 'playing') return;
    this.status = 'paused';
    this.cancelFrame();
    this.notifyFrame();
  }

  stop() {
    this.status = 'idle';
    this.cancelFrame();
    this.keyframeIndex = 0;
    this.progress = 0;
    this.elapsedInTransition = 0;

    // Reset to first keyframe
    if (this.sequence.keyframes.length > 0) {
      const kf = this.sequence.keyframes[0];
      this.interpolatedPlayers = kf.players;
      this.interpolatedBall = kf.ball;
      this.interpolatedAnnotations = kf.annotations;
    }
    this.notifyFrame();
  }

  seekToKeyframe(index: number) {
    if (index < 0 || index >= this.sequence.keyframes.length) return;

    const wasPlaying = this.status === 'playing';
    if (wasPlaying) {
      this.cancelFrame();
    }

    this.keyframeIndex = index;
    this.progress = 0;
    this.elapsedInTransition = 0;

    const kf = this.sequence.keyframes[index];
    this.interpolatedPlayers = kf.players;
    this.interpolatedBall = kf.ball;
    this.interpolatedAnnotations = kf.annotations;

    if (wasPlaying) {
      this.lastTimestamp = performance.now();
      this.scheduleFrame();
    }

    this.notifyFrame();
  }

  setSpeed(multiplier: number) {
    this.speedMultiplier = Math.max(0.25, Math.min(4, multiplier));
  }

  /**
   * Advance the playback by exactly `deltaMs` milliseconds (wall-clock).
   * Used for export (deterministic frame stepping, not wall-clock rAF).
   * Automatically starts playing if idle at keyframe 0.
   */
  stepFrame(deltaMs: number): void {
    if (this.sequence.keyframes.length < 2) return;

    // Auto-start if idle at beginning
    if (this.status === 'idle' && this.keyframeIndex === 0 && this.progress === 0) {
      this.status = 'playing';
      this.elapsedInTransition = 0;
    }

    if (this.status !== 'playing') return;

    const dt = deltaMs * this.speedMultiplier;
    this.elapsedInTransition += dt;

    const kfs = this.sequence.keyframes;
    const nextIdx = this.keyframeIndex + 1;

    if (nextIdx >= kfs.length) {
      this.status = 'idle';
      this.progress = 1;
      const lastKf = kfs[kfs.length - 1];
      this.interpolatedPlayers = lastKf.players;
      this.interpolatedBall = lastKf.ball;
      this.interpolatedAnnotations = lastKf.annotations;
      return;
    }

    const transitionDuration = kfs[nextIdx].durationMs;
    this.progress = Math.min(1, this.elapsedInTransition / transitionDuration);

    if (this.progress >= 1) {
      this.keyframeIndex = nextIdx;
      this.progress = 0;
      this.elapsedInTransition = 0;

      if (this.keyframeIndex >= kfs.length - 1) {
        this.status = 'idle';
        const lastKf = kfs[kfs.length - 1];
        this.interpolatedPlayers = lastKf.players;
        this.interpolatedBall = lastKf.ball;
        this.interpolatedAnnotations = lastKf.annotations;
        return;
      }
    }

    const from = kfs[this.keyframeIndex];
    const to = kfs[this.keyframeIndex + 1];
    const { players, ball } = interpolateKeyframes(from, to, this.progress);
    this.interpolatedPlayers = players;
    this.interpolatedBall = ball;
    this.resolveAnnotations(from, to, this.progress);
  }

  /** Get total duration in ms (accounting for speed multiplier) */
  getTotalDurationMs(): number {
    let total = 0;
    for (let i = 1; i < this.sequence.keyframes.length; i++) {
      total += this.sequence.keyframes[i].durationMs;
    }
    return total / this.speedMultiplier;
  }

  /** Get elapsed time in ms (accounting for speed multiplier) */
  getElapsedMs(): number {
    let elapsed = 0;
    // Sum all completed transitions
    for (let i = 1; i <= this.keyframeIndex; i++) {
      elapsed += this.sequence.keyframes[i].durationMs;
    }
    // Add progress in current transition
    if (this.keyframeIndex < this.sequence.keyframes.length - 1) {
      elapsed += this.progress * this.sequence.keyframes[this.keyframeIndex + 1].durationMs;
    }
    return elapsed / this.speedMultiplier;
  }

  // ── Private methods ──

  private scheduleFrame() {
    this.animId = requestAnimationFrame(this.tick);
  }

  private cancelFrame() {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  private tick = (timestamp: number) => {
    if (this.status !== 'playing') return;

    const dt = (timestamp - this.lastTimestamp) * this.speedMultiplier;
    this.lastTimestamp = timestamp;
    this.elapsedInTransition += dt;

    const kfs = this.sequence.keyframes;
    const nextIdx = this.keyframeIndex + 1;

    if (nextIdx >= kfs.length) {
      // Finished — show last frame
      this.status = 'idle';
      this.progress = 1;
      const lastKf = kfs[kfs.length - 1];
      this.interpolatedPlayers = lastKf.players;
      this.interpolatedBall = lastKf.ball;
      this.interpolatedAnnotations = lastKf.annotations;
      this.notifyFrame();
      return;
    }

    const transitionDuration = kfs[nextIdx].durationMs;
    this.progress = Math.min(1, this.elapsedInTransition / transitionDuration);

    if (this.progress >= 1) {
      // Advance to next transition
      this.keyframeIndex = nextIdx;
      this.progress = 0;
      this.elapsedInTransition = 0;

      // Check if we've reached the end
      if (this.keyframeIndex >= kfs.length - 1) {
        this.status = 'idle';
        const lastKf = kfs[kfs.length - 1];
        this.interpolatedPlayers = lastKf.players;
        this.interpolatedBall = lastKf.ball;
        this.interpolatedAnnotations = lastKf.annotations;
        this.notifyFrame();
        return;
      }
    }

    // Interpolate
    const from = kfs[this.keyframeIndex];
    const to = kfs[this.keyframeIndex + 1];
    const { players, ball } = interpolateKeyframes(from, to, this.progress);
    this.interpolatedPlayers = players;
    this.interpolatedBall = ball;

    // Resolve annotations: show from + progressively draw new ones
    this.resolveAnnotations(from, to, this.progress);

    this.notifyFrame();
    this.scheduleFrame();
  };

  /**
   * Resolve which annotations to show during a transition.
   * - Annotations in both from & to: show fully
   * - Annotations only in to (new): show with clipped endpoints based on progress
   * - Annotations only in from (removed): fade out (show with 1-t progress)
   */
  private resolveAnnotations(
    from: { annotations: Annotation[] },
    to: { annotations: Annotation[] },
    t: number,
  ) {
    const fromIds = new Set(from.annotations.map(a => a.id));
    const toIds = new Set(to.annotations.map(a => a.id));
    const result: Annotation[] = [];

    // Annotations in both: show from the `to` version (it may have moved)
    for (const ann of to.annotations) {
      if (fromIds.has(ann.id)) {
        result.push(ann);
      }
    }

    // New annotations (only in to): add with modified endpoints for progressive draw
    for (const ann of to.annotations) {
      if (!fromIds.has(ann.id)) {
        if (t > 0.05) {
          // For line annotations, clip the end position
          if (
            (ann.type === 'passing-line' || ann.type === 'running-line' || ann.type === 'curved-run' || ann.type === 'dribble-line') &&
            t < 1
          ) {
            const clippedEnd = {
              x: ann.start.x + (ann.end.x - ann.start.x) * t,
              y: ann.start.y + (ann.end.y - ann.start.y) * t,
            };
            result.push({
              ...ann,
              end: clippedEnd,
              // Remove endPlayerId during progressive draw so it doesn't snap
              endPlayerId: t >= 0.95 ? ann.endPlayerId : undefined,
            });
          } else {
            result.push(ann);
          }
        }
      }
    }

    // Removed annotations (only in from): show with diminishing opacity
    // For simplicity in V1, just keep showing them until halfway through
    for (const ann of from.annotations) {
      if (!toIds.has(ann.id) && t < 0.5) {
        result.push(ann);
      }
    }

    this.interpolatedAnnotations = result;
  }

  private notifyFrame() {
    this.onFrame?.(this.status, this.keyframeIndex, this.progress);
  }
}
