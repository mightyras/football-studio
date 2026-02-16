import type { AttackDirection, FormationPosition, Player } from '../types';
import { PITCH } from '../constants/pitch';

/**
 * Does this team's own goal sit at high-x (screen bottom)?
 * "Attacking up" means the team defends at the bottom (high-x) and attacks toward top (low-x).
 */
export function defendsHighX(team: 'A' | 'B', teamADirection: AttackDirection): boolean {
  return (team === 'A' && teamADirection === 'up') ||
         (team === 'B' && teamADirection === 'down');
}

/**
 * Convert world coordinates back to normalized (0-1) space.
 * Inverse of formationToWorld in the reducer.
 *
 * nx = depth from own goal (0 = near own GK, 1 = near opponent's goal)
 * ny = lateral position (0 = left, 1 = right)
 */
export function worldToNormalized(
  worldX: number,
  worldY: number,
  team: 'A' | 'B',
  teamADirection: AttackDirection,
): { x: number; y: number } {
  if (defendsHighX(team, teamADirection)) {
    // Own goal at high-x (bottom), GK at x≈105, forwards at x≈0
    return {
      x: (PITCH.length - worldX) / PITCH.length,
      y: worldY / PITCH.width,
    };
  } else {
    // Own goal at low-x (top), GK at x≈0, forwards at x≈105
    return {
      x: worldX / PITCH.length,
      y: worldY / PITCH.width,
    };
  }
}

/**
 * Greedy nearest-position assignment.
 *
 * For each target position (sorted by depth, defense-first), find the closest
 * unassigned player by Euclidean distance in normalized space and assign them.
 *
 * Returns a Map from playerId → target FormationPosition (includes role + defaultNumber).
 */
export function matchPlayersToPositions(
  players: Player[],
  targetPositions: FormationPosition[],
  team: 'A' | 'B',
  teamADirection: AttackDirection,
): Map<string, FormationPosition> {
  // Compute normalized positions for each player
  const playerNormalized = players.map(p => ({
    id: p.id,
    nx: worldToNormalized(p.x, p.y, team, teamADirection).x,
    ny: worldToNormalized(p.x, p.y, team, teamADirection).y,
  }));

  // Sort target positions by depth (defense first = low x)
  const sortedTargets = targetPositions
    .map((pos, originalIndex) => ({ ...pos, originalIndex }))
    .sort((a, b) => a.x - b.x);

  const assigned = new Set<string>();
  const result = new Map<string, FormationPosition>();

  for (const target of sortedTargets) {
    let bestId = '';
    let bestDist = Infinity;

    for (const pn of playerNormalized) {
      if (assigned.has(pn.id)) continue;

      const dx = pn.nx - target.x;
      const dy = pn.ny - target.y;
      const dist = dx * dx + dy * dy;

      if (dist < bestDist) {
        bestDist = dist;
        bestId = pn.id;
      }
    }

    if (bestId) {
      assigned.add(bestId);
      result.set(bestId, { x: target.x, y: target.y, role: target.role, defaultNumber: target.defaultNumber });
    }
  }

  return result;
}
