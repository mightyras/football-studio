/**
 * MP4 encoding via mediabunny + WebCodecs.
 *
 * Wraps mediabunny's CanvasSource / Output into a simple class for
 * frame-by-frame deterministic export and real-time clip recording.
 */
import {
  Output,
  BufferTarget,
  Mp4OutputFormat,
  CanvasSource,
  MediaStreamAudioTrackSource,
  canEncodeVideo,
  QUALITY_HIGH,
  type AudioEncodingConfig,
} from 'mediabunny';

export type VideoFormat = 'mp4' | 'webm';

/** Check if the browser supports MP4 encoding via WebCodecs. */
export async function supportsMP4Export(): Promise<boolean> {
  try {
    return await canEncodeVideo('avc');
  } catch {
    return false;
  }
}

/** Synchronous best-guess (WebCodecs API presence). Use supportsMP4Export() for a definitive answer. */
export function likelySupportsMp4(): boolean {
  return typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';
}

export interface MP4EncoderOptions {
  width: number;
  height: number;
  fps: number;
  bitrate?: number;
}

/**
 * Deterministic (frame-by-frame) MP4 encoder.
 * Caller renders to the provided canvas, then calls `addFrame()` for each frame.
 */
export class MP4FrameEncoder {
  private output: Output<Mp4OutputFormat, BufferTarget>;
  private videoSource: CanvasSource;
  private fps: number;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas, options: MP4EncoderOptions) {
    this.fps = options.fps;

    this.output = new Output({
      format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
      target: new BufferTarget(),
    });

    this.videoSource = new CanvasSource(canvas, {
      codec: 'avc',
      bitrate: options.bitrate ?? QUALITY_HIGH,
      keyFrameInterval: 2,
    });

    this.output.addVideoTrack(this.videoSource, { frameRate: options.fps });
  }

  async start(): Promise<void> {
    await this.output.start();
  }

  async addFrame(frameIndex: number): Promise<void> {
    const timestamp = frameIndex / this.fps;
    const duration = 1 / this.fps;
    await this.videoSource.add(timestamp, duration);
  }

  async finalize(): Promise<Blob> {
    await this.output.finalize();
    return new Blob([this.output.target.buffer!], { type: 'video/mp4' });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    try {
      this.output.finalize().catch(() => {});
    } catch { /* best-effort cleanup */ }
  }
}

export interface MP4ClipEncoderOptions {
  canvas: HTMLCanvasElement;
  fps: number;
  bitrate?: number;
  audioTrack?: MediaStreamTrack | null;
}

/**
 * Real-time MP4 clip encoder for analytics recordings.
 * Captures canvas frames on each `captureFrame()` call and optionally records audio.
 */
export class MP4ClipEncoder {
  private output: Output<Mp4OutputFormat, BufferTarget>;
  private videoSource: CanvasSource;
  private audioSource: MediaStreamAudioTrackSource | null = null;
  private fps: number;
  private startTime = 0;
  private lastCaptureTime = 0;
  private frameIndex = 0;
  private disposed = false;

  constructor(options: MP4ClipEncoderOptions) {
    this.fps = options.fps;

    this.output = new Output({
      format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
      target: new BufferTarget(),
    });

    this.videoSource = new CanvasSource(options.canvas, {
      codec: 'avc',
      bitrate: options.bitrate ?? 5_000_000,
      keyFrameInterval: 2,
    });

    this.output.addVideoTrack(this.videoSource, { frameRate: options.fps });

    if (options.audioTrack) {
      try {
        const audioConfig: AudioEncodingConfig = {
          codec: 'aac',
          bitrate: 128_000,
        };
        this.audioSource = new MediaStreamAudioTrackSource(
          options.audioTrack as MediaStreamAudioTrack,
          audioConfig,
        );
        this.output.addAudioTrack(this.audioSource);
      } catch {
        // Audio encoding not supported — video-only is fine
        this.audioSource = null;
      }
    }
  }

  async start(): Promise<void> {
    await this.output.start();
    this.startTime = performance.now();
    this.lastCaptureTime = 0;
    this.frameIndex = 0;
  }

  /**
   * Capture a frame if enough time has elapsed since the last capture.
   * Returns true if a frame was captured, false if skipped (too soon).
   * Call this from rAF — it self-throttles to the target fps.
   */
  async captureFrame(): Promise<boolean> {
    const now = performance.now();
    const elapsed = (now - this.startTime) / 1000;
    const minInterval = 1 / this.fps;

    // Skip if less than one frame interval has passed
    if (this.frameIndex > 0 && (elapsed - this.lastCaptureTime) < minInterval * 0.8) {
      return false;
    }

    const timestamp = this.frameIndex / this.fps;
    const duration = minInterval;
    await this.videoSource.add(timestamp, duration);
    this.lastCaptureTime = elapsed;
    this.frameIndex++;
    return true;
  }

  async finalize(): Promise<Blob> {
    await this.output.finalize();
    return new Blob([this.output.target.buffer!], { type: 'video/mp4' });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    try {
      this.audioSource?.pause();
      this.output.finalize().catch(() => {});
    } catch { /* best-effort cleanup */ }
  }
}
