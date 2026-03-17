import type { Player } from '../types';
import type { MatchPlan, MatchMinuteState } from '../types/matchManagement';

/**
 * Build the effective players array for canvas rendering in match management mode.
 *
 * - Team B players are returned unchanged.
 * - Team A players are derived from `matchState.onPitch`:
 *   - Each player is placed at the canvas position of the ORIGINAL starter
 *     whose starting role matches the player's CURRENT role.
 *   - This ensures that when roles swap (e.g., Sandra LW→CF and Julia T comes
 *     in as LW), each player ends up at the correct physical position on the pitch.
 *   - Starters who kept their role naturally anchor to their own position first.
 */
export function buildEffectivePlayers(
  allPlayers: Player[],
  matchState: MatchMinuteState,
  plan: MatchPlan,
): { players: Player[]; subbedInIds: Set<string> } {
  const teamBPlayers = allPlayers.filter(p => p.team === 'B');
  const originalTeamA = allPlayers.filter(p => p.team === 'A');

  // Build a pool of canvas positions from the original Team A players.
  // Each entry represents a physical slot on the pitch with its original role.
  const positionPool = originalTeamA.map(p => {
    const lineupEntry = plan.startingLineup.find(s => s.playerId === p.id);
    return {
      player: p,
      originalRole: lineupEntry?.role ?? p.role,
    };
  });

  const starterIds = new Set(plan.startingLineup.map(s => s.playerId));
  const subbedInIds = new Set<string>();

  // Sort on-pitch players: starters who kept their original role go first,
  // so they anchor to their own position before others claim slots by role.
  const onPitchSorted = [...matchState.onPitch].sort((a, b) => {
    const aOrig = plan.startingLineup.find(s => s.playerId === a.playerId)?.role;
    const bOrig = plan.startingLineup.find(s => s.playerId === b.playerId)?.role;
    const aKept = starterIds.has(a.playerId) && a.role === aOrig;
    const bKept = starterIds.has(b.playerId) && b.role === bOrig;
    if (aKept && !bKept) return -1;
    if (!aKept && bKept) return 1;
    return 0;
  });

  const usedIndices = new Set<number>();
  const effectiveTeamA: Player[] = [];

  for (const assignment of onPitchSorted) {
    const isStarter = starterIds.has(assignment.playerId);
    if (!isStarter) subbedInIds.add(assignment.playerId);

    let bestIdx = -1;

    // Priority 1: starter who kept their role — match to own position
    if (isStarter) {
      const selfIdx = positionPool.findIndex(
        (p, i) => !usedIndices.has(i) && p.player.id === assignment.playerId,
      );
      if (selfIdx !== -1 && positionPool[selfIdx].originalRole === assignment.role) {
        bestIdx = selfIdx;
      }
    }

    // Priority 2: match by current role — find a slot whose original role matches
    if (bestIdx === -1) {
      bestIdx = positionPool.findIndex(
        (p, i) => !usedIndices.has(i) && p.originalRole === assignment.role,
      );
    }

    // Priority 3: starter uses own position even if role changed (no role match found)
    if (bestIdx === -1 && isStarter) {
      bestIdx = positionPool.findIndex(
        (p, i) => !usedIndices.has(i) && p.player.id === assignment.playerId,
      );
    }

    // Priority 4: any remaining slot
    if (bestIdx === -1) {
      bestIdx = positionPool.findIndex((_, i) => !usedIndices.has(i));
    }

    if (bestIdx !== -1) {
      usedIndices.add(bestIdx);
      const pos = positionPool[bestIdx].player;
      effectiveTeamA.push({
        ...pos, // inherit x, y, facing, gkColor, and any other canvas properties
        id: assignment.playerId,
        team: 'A',
        number: assignment.number,
        name: assignment.name,
        role: assignment.role,
        isGK: assignment.isGK,
      });
    } else {
      // Fallback: center of pitch (shouldn't happen with balanced pools)
      effectiveTeamA.push({
        id: assignment.playerId,
        team: 'A',
        number: assignment.number,
        name: assignment.name,
        x: 52.5,
        y: 34,
        facing: 0,
        role: assignment.role,
        isGK: assignment.isGK,
      });
    }
  }

  return {
    players: [...effectiveTeamA, ...teamBPlayers],
    subbedInIds,
  };
}
