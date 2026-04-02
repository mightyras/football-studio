import { hexToRgba } from '../../utils/colorUtils';
import type { VideoAnnotation } from '../types';

// ── Fade timing constants ──

/** Base opacity for pen strokes */
export const PEN_BASE_OPACITY = 0.85;
/** How long a stroke stays at full opacity before fading (ms) */
export const PEN_HOLD_MS = 750;
/** Duration of the fade-out (ms) */
export const PEN_FADE_MS = 2250;
/** Total stroke lifetime (ms) */
export const PEN_TOTAL_MS = PEN_HOLD_MS + PEN_FADE_MS;
/** Total lifetime in seconds (for timeOut calculation) */
export const PEN_TOTAL_S = PEN_TOTAL_MS / 1000;

// ── Opacity calculations ──

/**
 * Compute opacity for a live/ephemeral stroke using wall-clock time.
 * Follows the ghostOpacity() pattern from renderPipeline.ts.
 */
export function computeLiveStrokeOpacity(drawnAt: number | undefined, now: number): number {
  if (!drawnAt || drawnAt <= 0) return PEN_BASE_OPACITY;
  const elapsed = now - drawnAt;
  if (elapsed <= PEN_HOLD_MS) return PEN_BASE_OPACITY;
  if (elapsed >= PEN_TOTAL_MS) return 0;
  const fadeProgress = (elapsed - PEN_HOLD_MS) / PEN_FADE_MS;
  return PEN_BASE_OPACITY * (1 - fadeProgress);
}

/**
 * Compute opacity for a clip-persisted stroke using video time.
 * Fades in over 200ms approaching timeIn, holds, fades out over 500ms before timeOut.
 */
export function computeClipStrokeOpacity(
  annotation: VideoAnnotation,
  currentVideoTime: number,
): number {
  const { timeIn, timeOut } = annotation;
  if (timeIn === undefined || timeOut === undefined) return PEN_BASE_OPACITY;

  const fadeInDuration = 0.2; // seconds
  const fadeOutDuration = 0.5; // seconds

  // Before the fade-in window
  if (currentVideoTime < timeIn - fadeInDuration) return 0;

  // Fade in
  if (currentVideoTime < timeIn) {
    const progress = (currentVideoTime - (timeIn - fadeInDuration)) / fadeInDuration;
    return PEN_BASE_OPACITY * Math.max(0, Math.min(1, progress));
  }

  // Fully visible hold period
  if (currentVideoTime <= timeOut - fadeOutDuration) return PEN_BASE_OPACITY;

  // Fade out
  if (currentVideoTime < timeOut) {
    const progress = (timeOut - currentVideoTime) / fadeOutDuration;
    return PEN_BASE_OPACITY * Math.max(0, Math.min(1, progress));
  }

  // After timeOut
  return 0;
}

// ── Stroke rendering ──

/**
 * Render a single freehand stroke to a canvas context.
 * Points are normalized 0-1 and scaled to canvasW/canvasH.
 * Uses quadratic bezier midpoint interpolation for smooth curves.
 */
export function renderStrokeToCanvas(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  color: string,
  lineWidth: number,
  opacity: number,
  canvasW: number,
  canvasH: number,
): void {
  if (points.length < 2 || opacity <= 0.01) return;

  ctx.save();
  ctx.strokeStyle = hexToRgba(color, opacity);
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Glow effect — colored shadow behind the stroke
  ctx.shadowColor = hexToRgba(color, opacity * 0.6);
  ctx.shadowBlur = lineWidth * 2.5;

  ctx.beginPath();

  const p0 = points[0];
  ctx.moveTo(p0.x * canvasW, p0.y * canvasH);

  if (points.length === 2) {
    // Simple line
    const p1 = points[1];
    ctx.lineTo(p1.x * canvasW, p1.y * canvasH);
  } else {
    // Smooth curve using quadratic bezier midpoint interpolation
    for (let i = 1; i < points.length - 1; i++) {
      const curr = points[i];
      const next = points[i + 1];
      const midX = (curr.x + next.x) / 2;
      const midY = (curr.y + next.y) / 2;
      ctx.quadraticCurveTo(
        curr.x * canvasW,
        curr.y * canvasH,
        midX * canvasW,
        midY * canvasH,
      );
    }
    // Last point
    const last = points[points.length - 1];
    ctx.lineTo(last.x * canvasW, last.y * canvasH);
  }

  ctx.stroke();
  ctx.restore();
}

/** Minimum bounding box (in normalized 0-1 coords) to distinguish a dot from a stroke */
const DOT_THRESHOLD = 0.015;

/**
 * Returns true if the points represent a "dot" (click with no meaningful drag).
 */
export function isDotAnnotation(points: { x: number; y: number }[]): boolean {
  if (points.length === 0) return false;
  if (points.length === 1) return true;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return (maxX - minX) < DOT_THRESHOLD && (maxY - minY) < DOT_THRESHOLD;
}

/**
 * Render a numbered circle marker at the given position.
 * Used for "dot" annotations — coach taps to count players.
 */
export function renderMarkerToCanvas(
  ctx: CanvasRenderingContext2D,
  point: { x: number; y: number },
  color: string,
  number: number,
  opacity: number,
  canvasW: number,
  canvasH: number,
): void {
  if (opacity <= 0.01) return;

  const cx = point.x * canvasW;
  const cy = point.y * canvasH;
  const radius = 14;
  const borderWidth = 2.5;

  ctx.save();

  // Glow
  ctx.shadowColor = hexToRgba(color, opacity * 0.5);
  ctx.shadowBlur = 12;

  // Filled circle
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = hexToRgba(color, opacity);
  ctx.fill();

  // Border
  ctx.shadowBlur = 0;
  ctx.lineWidth = borderWidth;
  ctx.strokeStyle = `rgba(0, 0, 0, ${opacity * 0.4})`;
  ctx.stroke();

  // Number text
  ctx.font = `bold ${radius}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Pick black or white text based on color brightness
  const h = color.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  ctx.fillStyle = `rgba(${luma > 160 ? '0,0,0' : '255,255,255'}, ${opacity})`;
  ctx.fillText(String(number), cx, cy + 1);

  ctx.restore();
}
