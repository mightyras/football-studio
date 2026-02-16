import type { BallState, Keyframe, Player } from '../types';

// ── Math Utilities ──

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Interpolate between two angles using shortest-path rotation.
 * Both angles in radians.
 */
export function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  // Normalize to [-PI, PI]
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return a + diff * t;
}

/**
 * Smooth ease-in-out cubic easing curve.
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ── Keyframe Interpolation ──

/**
 * Interpolate between two keyframes at progress `t` (0..1).
 * - Matches players by ID: lerps x, y, facing
 * - Players only in `to` snap to final position
 * - Players only in `from` are omitted (disappear)
 * - Ball: lerps x, y; computes rotation from distance
 */
export function interpolateKeyframes(
  from: Keyframe,
  to: Keyframe,
  t: number,
): { players: Player[]; ball: BallState } {
  const easedT = easeInOutCubic(t);

  // Build lookup of `from` players by ID
  const fromMap = new Map<string, Player>();
  for (const p of from.players) {
    fromMap.set(p.id, p);
  }

  // Interpolate players
  const players: Player[] = [];
  const seenIds = new Set<string>();

  for (const toP of to.players) {
    seenIds.add(toP.id);
    const fromP = fromMap.get(toP.id);

    if (fromP) {
      // Exists in both — interpolate
      players.push({
        ...toP,
        x: lerp(fromP.x, toP.x, easedT),
        y: lerp(fromP.y, toP.y, easedT),
        facing: lerpAngle(fromP.facing, toP.facing, easedT),
      });
    } else {
      // Only in `to` — snap to final position
      players.push({ ...toP });
    }
  }

  // Players only in `from` are omitted (they disappear at transition start)
  // This is the simplest approach — they're not in the target frame

  // Interpolate ball
  const ballDx = to.ball.x - from.ball.x;
  const ballDy = to.ball.y - from.ball.y;
  const ball: BallState = {
    ...to.ball,
    x: lerp(from.ball.x, to.ball.x, easedT),
    y: lerp(from.ball.y, to.ball.y, easedT),
    radius: lerp(from.ball.radius, to.ball.radius, easedT),
    // Compute rotation from interpolated distance traveled
    rotationX: from.ball.rotationX + (ballDx * easedT) / from.ball.radius,
    rotationY: from.ball.rotationY + (ballDy * easedT) / from.ball.radius,
  };

  return { players, ball };
}
