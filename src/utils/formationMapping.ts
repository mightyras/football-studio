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
  // Must reverse the half-field compression used by formationToWorld:
  //   formationToWorld does: mappedDepth = halfStart + pos.x * (halfEnd - halfStart)
  //   worldX = PITCH.length * mappedDepth  (or PITCH.length * (1 - mappedDepth) for high-x)
  // So we invert: pos.x = (mappedDepth - halfStart) / (halfEnd - halfStart)
  const halfStart = 0.08;
  const halfEnd = 0.55;

  let rawDepth: number;
  if (defendsHighX(team, teamADirection)) {
    // Own goal at high-x (bottom), GK at x≈105, forwards at x≈0
    rawDepth = (PITCH.length - worldX) / PITCH.length;
  } else {
    // Own goal at low-x (top), GK at x≈0, forwards at x≈105
    rawDepth = worldX / PITCH.length;
  }

  return {
    x: (rawDepth - halfStart) / (halfEnd - halfStart),
    y: worldY / PITCH.width,
  };
}

/**
 * Match players to formation positions by jersey number.
 *
 * Each formation position has a `defaultNumber` that maps to a specific jersey.
 * Players are matched to positions by their jersey number first (deterministic),
 * with proximity-based fallback for any players whose numbers don't match a slot.
 *
 * Returns a Map from playerId → target FormationPosition (includes role + defaultNumber).
 */
export function matchPlayersToPositions(
  players: Player[],
  targetPositions: FormationPosition[],
  team: 'A' | 'B',
  teamADirection: AttackDirection,
): Map<string, FormationPosition> {
  const result = new Map<string, FormationPosition>();
  if (players.length === 0 || targetPositions.length === 0) return result;

  const usedPositionIndices = new Set<number>();
  const unmatchedPlayers: Player[] = [];

  // Phase 1: Match by jersey number (player.number === position.defaultNumber)
  for (const player of players) {
    const posIdx = targetPositions.findIndex(
      (pos, i) => !usedPositionIndices.has(i) && pos.defaultNumber === player.number,
    );
    if (posIdx !== -1) {
      result.set(player.id, targetPositions[posIdx]);
      usedPositionIndices.add(posIdx);
    } else {
      unmatchedPlayers.push(player);
    }
  }

  // Phase 2: For remaining unmatched players, assign by proximity to unused positions
  if (unmatchedPlayers.length > 0) {
    const unusedPositions = targetPositions
      .map((pos, i) => ({ pos, i }))
      .filter(({ i }) => !usedPositionIndices.has(i));

    // Greedy nearest-match for the remaining few players
    const usedRemainder = new Set<number>();
    for (const player of unmatchedPlayers) {
      const norm = worldToNormalized(player.x, player.y, team, teamADirection);
      let bestIdx = -1;
      let bestDist = Infinity;
      for (let j = 0; j < unusedPositions.length; j++) {
        if (usedRemainder.has(j)) continue;
        const pos = unusedPositions[j].pos;
        const dx = norm.x - pos.x;
        const dy = norm.y - pos.y;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = j;
        }
      }
      if (bestIdx !== -1) {
        result.set(player.id, unusedPositions[bestIdx].pos);
        usedRemainder.add(bestIdx);
      }
    }
  }

  return result;
}
