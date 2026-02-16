import type { AnimationSequence, AppState } from '../types';
import { PlaybackController } from './playbackController';
import { render } from '../canvas/renderPipeline';
import { computeTransform } from '../hooks/usePitchTransform';

export interface ExportOptions {
  fps: number;      // 24, 30, or 60
  width: number;    // e.g., 1280 or 1920
  height: number;   // e.g., 720 or 1080
}

export type ExportProgressCallback = (progress: number) => void;

/**
 * Export an animation sequence as a WebM video.
 *
 * Uses native canvas.captureStream() + MediaRecorder — zero external dependencies.
 * Renders each frame deterministically via PlaybackController.stepFrame().
 */
export class ExportController {
  private sequence: AnimationSequence;
  private baseState: AppState;
  private options: ExportOptions;
  private cancelled = false;

  constructor(
    sequence: AnimationSequence,
    baseState: AppState,
    options: ExportOptions,
  ) {
    this.sequence = sequence;
    this.baseState = baseState;
    this.options = options;
  }

  cancel(): void {
    this.cancelled = true;
  }

  async exportWebM(onProgress?: ExportProgressCallback): Promise<Blob> {
    const { fps, width, height } = this.options;

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
      throw new Error('Your browser does not support canvas.captureStream(). Try Chrome or Firefox.');
    }

    // Set up MediaRecorder
    const stream = canvas.captureStream(0); // 0 = manual frame capture

    // Try VP9 first, fall back to default
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

    // Create playback controller for stepping
    const controller = new PlaybackController(this.sequence);

    // Compute total duration and frames
    let totalDurationMs = 0;
    for (let i = 1; i < this.sequence.keyframes.length; i++) {
      totalDurationMs += this.sequence.keyframes[i].durationMs;
    }
    totalDurationMs /= this.sequence.speedMultiplier;

    const dtMs = 1000 / fps;
    const totalFrames = Math.ceil(totalDurationMs / dtMs) + 1;

    return new Promise<Blob>((resolve, reject) => {
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        resolve(blob);
      };
      mediaRecorder.onerror = () => {
        reject(new Error('MediaRecorder error during export'));
      };

      mediaRecorder.start();

      let frameIndex = 0;

      const renderNextFrame = () => {
        if (this.cancelled) {
          mediaRecorder.stop();
          reject(new Error('Export cancelled'));
          return;
        }

        if (frameIndex > totalFrames || controller.status === 'idle' && frameIndex > 0) {
          // Done — stop recording
          mediaRecorder.stop();
          return;
        }

        // Build render state from controller
        const renderState: AppState = {
          ...this.baseState,
          players: controller.interpolatedPlayers,
          ball: controller.interpolatedBall,
          annotations: controller.interpolatedAnnotations,
          selectedPlayerId: null,
          hoveredPlayerId: null,
          ballSelected: false,
          ballHovered: false,
          selectedAnnotationId: null,
          drawingInProgress: null,
        };

        // Render frame
        ctx.clearRect(0, 0, width, height);
        render(ctx, transform, renderState, width, height);

        // Request frame capture
        const track = stream.getVideoTracks()[0];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((track as any).requestFrame) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (track as any).requestFrame();
        }

        // Step controller for next frame
        controller.stepFrame(dtMs);

        // Report progress
        onProgress?.(Math.min(1, frameIndex / totalFrames));

        frameIndex++;

        // Yield to UI thread
        setTimeout(renderNextFrame, 0);
      };

      renderNextFrame();
    });
  }
}
