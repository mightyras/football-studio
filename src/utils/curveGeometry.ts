import type { WorldPoint } from '../types';

export const CURVE_BULGE_FACTOR = 0.5; // perpendicular offset as fraction of line length

/**
 * Compute the quadratic-bezier control point for a curved-run.
 * The control point sits at the midpoint of start→end, offset perpendicular
 * to the left (relative to the direction of travel).
 */
export function curvedRunControlPoint(
  start: WorldPoint,
  end: WorldPoint,
  direction: 'left' | 'right' = 'left',
): WorldPoint {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length < 0.01) return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };

  const sign = direction === 'right' ? -1 : 1;
  const perpX = sign * (-dy / length);
  const perpY = sign * (dx / length);
  const bulge = length * CURVE_BULGE_FACTOR;

  return {
    x: (start.x + end.x) / 2 + perpX * bulge,
    y: (start.y + end.y) / 2 + perpY * bulge,
  };
}
