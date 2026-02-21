import type { Annotation, PreviewGhost, WorldPoint } from '../types';

/**
 * Find the closest preview ghost for a given player to a reference position.
 * With multiple ghosts per player (chained runs/dribbles), this picks the one
 * that best matches an annotation's stored start/end coordinate.
 */
export function findClosestGhost(
  previewGhosts: PreviewGhost[],
  playerId: string,
  refPos: WorldPoint,
): PreviewGhost | undefined {
  const playerGhosts = previewGhosts.filter(g => g.playerId === playerId);
  if (playerGhosts.length === 0) return undefined;
  if (playerGhosts.length === 1) return playerGhosts[0];

  let best: PreviewGhost | undefined;
  let bestDist = Infinity;
  for (const g of playerGhosts) {
    const dx = refPos.x - g.x;
    const dy = refPos.y - g.y;
    const d = dx * dx + dy * dy;
    if (d < bestDist) {
      bestDist = d;
      best = g;
    }
  }
  return best;
}

type LineAnn = Extract<Annotation, { type: 'passing-line' | 'running-line' | 'curved-run' | 'dribble-line' }>;

/**
 * Compute the minimum allowed animStep for an annotation that starts
 * from a preview ghost position.
 *
 * The min step = max(animStep of all annotations that deliver to that ghost) + 1
 *
 * "Deliver to" means:
 *   - A run/curved-run/dribble whose endpoint IS the ghost (sourceAnnotationId matches)
 *   - A pass whose endPlayerId is the same player and targets the ghost position
 *
 * Returns 1 if not starting from a ghost (no constraint).
 */
export function computeMinStepForGhostStart(
  startPlayerId: string,
  startPos: WorldPoint,
  annotations: Annotation[],
  previewGhosts: PreviewGhost[],
): number {
  // Find the preview ghost at startPos
  const ghost = findClosestGhost(previewGhosts, startPlayerId, startPos);
  if (!ghost) return 1; // not starting from a ghost

  // Check distance — only constrain if we're actually close to a ghost
  const dx = ghost.x - startPos.x;
  const dy = ghost.y - startPos.y;
  if (dx * dx + dy * dy > 1.0) return 1; // too far, not a ghost start

  let maxIncomingStep = 0;

  // 1. The annotation that created this ghost (the run/dribble that moves the player here)
  const creatorAnn = annotations.find(a => a.id === ghost.sourceAnnotationId);
  if (creatorAnn && 'animStep' in creatorAnn) {
    maxIncomingStep = Math.max(maxIncomingStep, (creatorAnn as LineAnn).animStep ?? 1);
  }

  // 2. Any pass that ends at this player near the ghost position
  const animatableTypes = ['passing-line'] as const;
  for (const ann of annotations) {
    if (!animatableTypes.includes(ann.type as typeof animatableTypes[number])) continue;
    const lineAnn = ann as LineAnn;
    if (lineAnn.endPlayerId !== startPlayerId) continue;
    // Check if the pass endpoint is near the ghost position
    const pdx = lineAnn.end.x - ghost.x;
    const pdy = lineAnn.end.y - ghost.y;
    if (pdx * pdx + pdy * pdy < 2.0) {
      maxIncomingStep = Math.max(maxIncomingStep, lineAnn.animStep ?? 1);
    }
  }

  return maxIncomingStep > 0 ? maxIncomingStep + 1 : 1;
}
