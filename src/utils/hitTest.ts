import type { Player, PitchTransform, BallState } from '../types';
import { getPlayerScreenRadius } from '../canvas/PlayerRenderer';
import { getBallScreenRadius } from '../canvas/BallRenderer';

/**
 * Point-in-triangle test using cross products.
 */
function pointInTriangle(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
  cx: number, cy: number,
): boolean {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
  return !(hasNeg && hasPos);
}

/**
 * Find a player whose orientation notch (triangle pointer) is under the cursor.
 * Returns null if orientation is hidden or no notch is hit.
 */
export function findPlayerNotchAtScreen(
  screenX: number,
  screenY: number,
  players: Player[],
  transform: PitchTransform,
  playerRadius: number = 1.6,
  showOrientation: boolean = true,
): Player | null {
  if (!showOrientation) return null;

  for (let i = players.length - 1; i >= 0; i--) {
    const p = players[i];
    const pos = transform.worldToScreen(p.x, p.y);
    const radius = getPlayerScreenRadius(transform, playerRadius);

    // Compute notch triangle in screen space (matching PlayerRenderer.ts geometry)
    const screenAngle = (Math.PI / 2 - transform.rotation) - p.facing;
    // Generous hit zone: extend tip, widen angle, pull base inward
    const notchLength = radius * 0.55 + 4;
    const notchHalfWidth = Math.PI * 0.14 + 0.05;
    const baseR = radius - 2;

    const tipX = pos.x + Math.cos(screenAngle) * (radius + notchLength);
    const tipY = pos.y + Math.sin(screenAngle) * (radius + notchLength);
    const baseLeftX = pos.x + Math.cos(screenAngle - notchHalfWidth) * baseR;
    const baseLeftY = pos.y + Math.sin(screenAngle - notchHalfWidth) * baseR;
    const baseRightX = pos.x + Math.cos(screenAngle + notchHalfWidth) * baseR;
    const baseRightY = pos.y + Math.sin(screenAngle + notchHalfWidth) * baseR;

    if (pointInTriangle(screenX, screenY, tipX, tipY, baseLeftX, baseLeftY, baseRightX, baseRightY)) {
      return p;
    }
  }
  return null;
}

export function findPlayerAtScreen(
  screenX: number,
  screenY: number,
  players: Player[],
  transform: PitchTransform,
  playerRadius: number = 1.6,
): Player | null {
  const hitRadius = getPlayerScreenRadius(transform, playerRadius) + 4;

  for (let i = players.length - 1; i >= 0; i--) {
    const p = players[i];
    const pos = transform.worldToScreen(p.x, p.y);
    const dx = screenX - pos.x;
    const dy = screenY - pos.y;
    if (dx * dx + dy * dy <= hitRadius * hitRadius) {
      return p;
    }
  }
  return null;
}

export function isBallAtScreen(
  screenX: number,
  screenY: number,
  ball: BallState,
  transform: PitchTransform,
): boolean {
  const pos = transform.worldToScreen(ball.x, ball.y);
  const hitRadius = getBallScreenRadius(transform, ball) + 4;
  const dx = screenX - pos.x;
  const dy = screenY - pos.y;
  return dx * dx + dy * dy <= hitRadius * hitRadius;
}
