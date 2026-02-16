import type { PlayerRunAnimation } from '../types';
import { easeInOutCubic } from './interpolationEngine';

export type PlayerRunFrame = {
  playerId: string;
  x: number;
  y: number;
  facing: number;
  progress: number;         // raw 0..1
  easedProgress: number;    // eased 0..1 — matches visual position on path
  finished: boolean;
  ballX?: number;           // ball position during pass/dribble animations
  ballY?: number;
};

/**
 * Interpolate position along the path (straight line or quadratic bezier).
 */
function interpolatePath(
  anim: PlayerRunAnimation,
  t: number,
): { x: number; y: number; tangentX: number; tangentY: number } {
  let x: number;
  let y: number;
  let tangentX: number;
  let tangentY: number;

  if (anim.controlPoint) {
    // Quadratic Bézier: P(t) = (1-t)²·S + 2(1-t)t·CP + t²·E
    const s = anim.startPos;
    const cp = anim.controlPoint;
    const e = anim.endPos;
    const oneMinusT = 1 - t;

    x = oneMinusT * oneMinusT * s.x + 2 * oneMinusT * t * cp.x + t * t * e.x;
    y = oneMinusT * oneMinusT * s.y + 2 * oneMinusT * t * cp.y + t * t * e.y;

    // Tangent of quadratic bezier: P'(t) = 2(1-t)(CP-S) + 2t(E-CP)
    tangentX = 2 * oneMinusT * (cp.x - s.x) + 2 * t * (e.x - cp.x);
    tangentY = 2 * oneMinusT * (cp.y - s.y) + 2 * t * (e.y - cp.y);
  } else {
    // Straight line: P(t) = S + t·(E - S)
    x = anim.startPos.x + t * (anim.endPos.x - anim.startPos.x);
    y = anim.startPos.y + t * (anim.endPos.y - anim.startPos.y);

    tangentX = anim.endPos.x - anim.startPos.x;
    tangentY = anim.endPos.y - anim.startPos.y;
  }

  return { x, y, tangentX, tangentY };
}

/**
 * Compute the current position of a player/ball along a line path.
 * Supports run (player moves), pass (ball moves, player stays), and dribble (both move).
 */
export function computeRunFrame(
  anim: PlayerRunAnimation,
  now: number,
): PlayerRunFrame {
  const elapsed = now - anim.startTime;
  const rawT = Math.min(1, Math.max(0, elapsed / anim.durationMs));
  const t = easeInOutCubic(rawT);

  const { x, y, tangentX, tangentY } = interpolatePath(anim, t);

  // Facing direction from tangent vector (fallback to 0 if zero-length)
  const facing = (tangentX === 0 && tangentY === 0)
    ? 0
    : Math.atan2(tangentY, tangentX);

  const animationType = anim.animationType ?? 'run';

  if (animationType === 'pass') {
    // Pass: ball travels along the path, player stays at start
    return {
      playerId: anim.playerId,
      x: anim.startPos.x,
      y: anim.startPos.y,
      facing,
      progress: rawT,
      easedProgress: t,
      finished: rawT >= 1,
      ballX: x,
      ballY: y,
    };
  }

  if (animationType === 'dribble') {
    // Dribble: player + ball travel along the path.
    // Player gets subtle lateral oscillation for dribble impression.
    const tangentLen = Math.sqrt(tangentX * tangentX + tangentY * tangentY);
    let playerX = x;
    let playerY = y;

    if (tangentLen > 0) {
      // Perpendicular to tangent (normalised)
      const perpX = -tangentY / tangentLen;
      const perpY = tangentX / tangentLen;
      // Oscillate: amplitude 0.15 world units, ~8Hz, fade out near end
      const amplitude = 0.15 * Math.sin(rawT * Math.PI); // envelope: 0 at start/end
      const oscillation = Math.sin(rawT * anim.durationMs * 0.05) * amplitude;
      playerX += perpX * oscillation;
      playerY += perpY * oscillation;
    }

    return {
      playerId: anim.playerId,
      x: playerX,
      y: playerY,
      facing,
      progress: rawT,
      easedProgress: t,
      finished: rawT >= 1,
      ballX: x,
      ballY: y,
    };
  }

  // Run: player moves along the path, no ball
  return {
    playerId: anim.playerId,
    x,
    y,
    facing,
    progress: rawT,
    easedProgress: t,
    finished: rawT >= 1,
  };
}
