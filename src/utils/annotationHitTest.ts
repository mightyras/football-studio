import type { Annotation, GhostPlayer, Player, PitchTransform, WorldPoint } from '../types';
import { curvedRunControlPoint } from './curveGeometry';

const LINE_HIT_THRESHOLD = 8; // screen pixels

/**
 * Point-to-segment distance in screen space.
 */
function distToSegment(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const nearX = x1 + t * dx;
  const nearY = y1 + t * dy;
  return Math.sqrt((px - nearX) ** 2 + (py - nearY) ** 2);
}

/**
 * Point-in-polygon (ray casting).
 */
function pointInPolygon(
  px: number, py: number,
  polygon: { x: number; y: number }[],
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > py) !== (yj > py)) &&
      (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Distance from point to polyline (chain of segments).
 */
function distToPolyline(
  px: number, py: number,
  points: { x: number; y: number }[],
): number {
  let minDist = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const d = distToSegment(px, py, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

/**
 * Sample a quadratic bézier curve into a polyline.
 */
function sampleQuadraticBezier(
  start: { x: number; y: number },
  cp: { x: number; y: number },
  end: { x: number; y: number },
  segments: number = 20,
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const mt = 1 - t;
    points.push({
      x: mt * mt * start.x + 2 * mt * t * cp.x + t * t * end.x,
      y: mt * mt * start.y + 2 * mt * t * cp.y + t * t * end.y,
    });
  }
  return points;
}

/**
 * Distance from a point to a quadratic bézier curve (via polyline approximation).
 */
function distToQuadraticBezier(
  px: number, py: number,
  start: { x: number; y: number },
  cp: { x: number; y: number },
  end: { x: number; y: number },
): number {
  return distToPolyline(px, py, sampleQuadraticBezier(start, cp, end));
}

function resolvePlayerPositions(
  playerIds: string[],
  players: Player[],
): WorldPoint[] {
  const result: WorldPoint[] = [];
  for (const id of playerIds) {
    const p = players.find(pl => pl.id === id);
    if (p) result.push({ x: p.x, y: p.y });
  }
  return result;
}

/**
 * Find the annotation under the given screen position.
 * Iterates in reverse (last rendered = on top).
 */
export function findAnnotationAtScreen(
  screenX: number,
  screenY: number,
  annotations: Annotation[],
  players: Player[],
  transform: PitchTransform,
  ghostAnnotationIds: string[] = [],
  ghostPlayers: GhostPlayer[] = [],
): Annotation | null {
  // Check in reverse order (topmost first)
  for (let i = annotations.length - 1; i >= 0; i--) {
    const ann = annotations[i];

    // For ghost annotations, use ghost player positions so the hit test
    // matches the rendered line (which uses ghost positions, not current player pos).
    const isGhostAnn = ghostAnnotationIds.includes(ann.id);
    let effectivePlayers = players;
    if (isGhostAnn) {
      const annWithStart = ann as { startPlayerId?: string };
      if (annWithStart.startPlayerId) {
        const ghost = ghostPlayers.find(g => g.playerId === annWithStart.startPlayerId);
        if (ghost) {
          effectivePlayers = players.map(p =>
            p.id === ghost.playerId ? { ...p, x: ghost.x, y: ghost.y } : p
          );
        }
      }
    }

    switch (ann.type) {
      case 'text': {
        // Approximate bounding box
        const pos = transform.worldToScreen(ann.position.x, ann.position.y);
        const fontSize = Math.max(10, ann.fontSize * transform.scale);
        const estimatedWidth = ann.text.length * fontSize * 0.6; // rough estimate
        const px = 6;
        const py = 3;
        const left = pos.x - estimatedWidth / 2 - px;
        const right = pos.x + estimatedWidth / 2 + px;
        const top = pos.y - fontSize / 2 - py;
        const bottom = pos.y + fontSize / 2 + py;
        if (screenX >= left && screenX <= right && screenY >= top && screenY <= bottom) {
          return ann;
        }
        break;
      }
      case 'passing-line':
      case 'running-line':
      case 'dribble-line': {
        // Resolve player-snapped endpoints (use effectivePlayers for ghost annotations)
        let startPt = ann.start;
        let endPt = ann.end;
        if (ann.startPlayerId) {
          const p = effectivePlayers.find(pl => pl.id === ann.startPlayerId);
          if (p) startPt = { x: p.x, y: p.y };
        }
        if (ann.endPlayerId) {
          const p = effectivePlayers.find(pl => pl.id === ann.endPlayerId);
          if (p) endPt = { x: p.x, y: p.y };
        }
        const s = transform.worldToScreen(startPt.x, startPt.y);
        const e = transform.worldToScreen(endPt.x, endPt.y);
        const d = distToSegment(screenX, screenY, s.x, s.y, e.x, e.y);
        if (d <= LINE_HIT_THRESHOLD) return ann;
        break;
      }
      case 'curved-run': {
        // Resolve player-snapped endpoints (use effectivePlayers for ghost annotations)
        let startPt = ann.start;
        let endPt = ann.end;
        if (ann.startPlayerId) {
          const p = effectivePlayers.find(pl => pl.id === ann.startPlayerId);
          if (p) startPt = { x: p.x, y: p.y };
        }
        if (ann.endPlayerId) {
          const p = effectivePlayers.find(pl => pl.id === ann.endPlayerId);
          if (p) endPt = { x: p.x, y: p.y };
        }
        // Compute control point in world space, convert all to screen space
        const cpWorld = curvedRunControlPoint(startPt, endPt, ann.curveDirection);
        const s = transform.worldToScreen(startPt.x, startPt.y);
        const e = transform.worldToScreen(endPt.x, endPt.y);
        const cp = transform.worldToScreen(cpWorld.x, cpWorld.y);
        const d = distToQuadraticBezier(screenX, screenY, s, cp, e);
        if (d <= LINE_HIT_THRESHOLD) return ann;
        break;
      }
      case 'polygon': {
        if (ann.points.length < 3) break;
        const screenPts = ann.points.map(p => transform.worldToScreen(p.x, p.y));
        if (pointInPolygon(screenX, screenY, screenPts)) return ann;
        // Also check edge proximity
        if (distToPolyline(screenX, screenY, [...screenPts, screenPts[0]]) <= LINE_HIT_THRESHOLD) return ann;
        break;
      }
      case 'player-polygon': {
        const worldPts = resolvePlayerPositions(ann.playerIds, players);
        if (worldPts.length < 3) break;
        const screenPts = worldPts.map(p => transform.worldToScreen(p.x, p.y));
        if (pointInPolygon(screenX, screenY, screenPts)) return ann;
        if (distToPolyline(screenX, screenY, [...screenPts, screenPts[0]]) <= LINE_HIT_THRESHOLD) return ann;
        break;
      }
      case 'ellipse': {
        const center = transform.worldToScreen(ann.center.x, ann.center.y);
        const rx = ann.radiusX * transform.scale;
        const ry = ann.radiusY * transform.scale;
        if (rx < 1 || ry < 1) break;
        // Normalized distance from center
        const ndx = (screenX - center.x) / rx;
        const ndy = (screenY - center.y) / ry;
        const dist = ndx * ndx + ndy * ndy;
        // Inside ellipse
        if (dist <= 1) return ann;
        // Edge proximity: check if close to the boundary
        // dist ≈ 1 means on the edge; allow some threshold
        const edgeThreshold = LINE_HIT_THRESHOLD / Math.min(rx, ry);
        if (Math.abs(Math.sqrt(dist) - 1) <= edgeThreshold) return ann;
        break;
      }
      case 'player-line': {
        const worldPts = resolvePlayerPositions(ann.playerIds, players);
        if (worldPts.length < 2) break;
        const screenPts = worldPts.map(p => transform.worldToScreen(p.x, p.y));
        // Use the rendered width as the hit threshold (at least LINE_HIT_THRESHOLD)
        const threshold = Math.max(LINE_HIT_THRESHOLD, ann.lineWidth * transform.scale / 2 + 4);
        if (distToPolyline(screenX, screenY, screenPts) <= threshold) return ann;
        break;
      }
      case 'player-marking': {
        const p1 = players.find(p => p.id === ann.markedPlayerId);
        const p2 = players.find(p => p.id === ann.markingPlayerId);
        if (!p1 || !p2) break;

        const s1 = transform.worldToScreen(p1.x, p1.y);
        const s2 = transform.worldToScreen(p2.x, p2.y);
        // Corridor hit = distance to segment ≤ cap radius
        const capRadius = 1.6 * transform.scale + 6;
        const segDist = distToSegment(screenX, screenY, s1.x, s1.y, s2.x, s2.y);
        if (segDist <= capRadius + LINE_HIT_THRESHOLD) return ann;
        break;
      }
    }
  }

  return null;
}
