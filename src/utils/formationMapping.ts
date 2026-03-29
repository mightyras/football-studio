import type { AttackDirection, FormationPosition, Player, PositionRole } from '../types';
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

/**
 * Match players to formation positions by their **current role** first,
 * preserving manual positioning from the board.
 *
 * Phase 1: Match by role (player.role === position.role).
 *   When multiple positions share the same role, prefer the one whose
 *   defaultNumber matches the player's jersey number.
 * Phase 2: Proximity fallback for any remaining unmatched players.
 */
export function matchPlayersByRole(
  players: Player[],
  targetPositions: FormationPosition[],
  team: 'A' | 'B',
  teamADirection: AttackDirection,
): Map<string, FormationPosition> {
  const result = new Map<string, FormationPosition>();
  if (players.length === 0 || targetPositions.length === 0) return result;

  const usedPositionIndices = new Set<number>();
  const unmatchedPlayers: Player[] = [];

  // Phase 1: Match by current role
  for (const player of players) {
    if (!player.role) {
      unmatchedPlayers.push(player);
      continue;
    }
    // Find all unused positions with the same role
    const candidates = targetPositions
      .map((pos, i) => ({ pos, i }))
      .filter(({ pos, i }) => !usedPositionIndices.has(i) && pos.role === player.role);

    if (candidates.length === 0) {
      unmatchedPlayers.push(player);
      continue;
    }

    // Prefer the position whose defaultNumber matches the player's jersey
    const byNumber = candidates.find(c => c.pos.defaultNumber === player.number);
    const chosen = byNumber ?? candidates[0];
    result.set(player.id, chosen.pos);
    usedPositionIndices.add(chosen.i);
  }

  // Phase 2: Proximity fallback for unmatched players
  if (unmatchedPlayers.length > 0) {
    const unusedPositions = targetPositions
      .map((pos, i) => ({ pos, i }))
      .filter(({ i }) => !usedPositionIndices.has(i));

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

/**
 * Sort items that have a role (and optionally a number) by their formation position:
 *   1. GK first
 *   2. Then by depth (x ascending — own goal to opponent goal)
 *   3. Then left-to-right within each line (y ascending)
 *
 * If a role appears multiple times in the formation, players are matched
 * to positions by their jersey number (via defaultNumber) for stable ordering.
 */
export function sortByFormationPosition<T extends { role: PositionRole; number?: number }>(
  items: T[],
  positions: FormationPosition[],
): T[] {
  // Build a lookup: for each role, collect positions sorted by y (left-to-right)
  const positionsByRole = new Map<PositionRole, FormationPosition[]>();
  for (const pos of positions) {
    const arr = positionsByRole.get(pos.role) ?? [];
    arr.push(pos);
    positionsByRole.set(pos.role, arr);
  }
  // Sort each role's positions by y for stable left-to-right ordering
  for (const arr of positionsByRole.values()) {
    arr.sort((a, b) => a.y - b.y);
  }

  // For each item, find its matching formation position
  // When multiple positions share the same role, prefer matching by defaultNumber
  const usedPositions = new Set<FormationPosition>();

  function findPosition(item: T): FormationPosition | undefined {
    const candidates = positionsByRole.get(item.role);
    if (!candidates || candidates.length === 0) return undefined;
    // Try to match by jersey number first
    if (item.number !== undefined) {
      const byNumber = candidates.find(p => p.defaultNumber === item.number && !usedPositions.has(p));
      if (byNumber) {
        usedPositions.add(byNumber);
        return byNumber;
      }
    }
    // Fallback: first unused position for this role
    const fallback = candidates.find(p => !usedPositions.has(p));
    if (fallback) {
      usedPositions.add(fallback);
      return fallback;
    }
    return candidates[0]; // all taken, just use first
  }

  // Pair items with their positions
  const paired = items.map(item => ({
    item,
    pos: findPosition(item),
  }));

  // Group positions into "lines" by x-proximity.
  // E.g. fullbacks at x=0.18 and CBs at x=0.12 are the same defensive line.
  const LINE_THRESHOLD = 0.10;
  const xValues = positions.map(p => p.x).sort((a, b) => a - b);
  const lineBreaks: number[] = []; // midpoints between lines
  for (let i = 1; i < xValues.length; i++) {
    if (xValues[i] - xValues[i - 1] > LINE_THRESHOLD) {
      lineBreaks.push((xValues[i] + xValues[i - 1]) / 2);
    }
  }
  function getLineIndex(x: number): number {
    let line = 0;
    for (const brk of lineBreaks) {
      if (x > brk) line++;
    }
    return line;
  }

  // Sort: GK first, then by line (back to front), then left-to-right within each line
  return paired
    .sort((a, b) => {
      if (a.item.role === 'GK' && b.item.role !== 'GK') return -1;
      if (a.item.role !== 'GK' && b.item.role === 'GK') return 1;
      const aLine = getLineIndex(a.pos?.x ?? 0);
      const bLine = getLineIndex(b.pos?.x ?? 0);
      if (aLine !== bLine) return aLine - bLine;
      return (a.pos?.y ?? 0) - (b.pos?.y ?? 0);
    })
    .map(p => p.item);
}
