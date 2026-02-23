import type { Annotation, DrawingInProgress, DrawSubTool, GhostPlayer, PassingLineAnnotation, PlayerMarkingAnnotation, PreviewGhost, RunningLineAnnotation, CurvedRunAnnotation, DribbleLineAnnotation, Player, PitchTransform, RunAnimationOverlay, WorldPoint } from '../types';
import { THEME } from '../constants/colors';
import { curvedRunControlPoint, CURVE_BULGE_FACTOR } from '../utils/curveGeometry';
import { findClosestGhost } from '../utils/ghostUtils';

// ── Constants ──

const LINE_WIDTH_WORLD = 0.18;      // world units for passing/running/dribble lines
const ARROW_HEAD_LEN = 8;           // screen pixels
const WAVY_AMPLITUDE = 0.7;         // world units
const WAVY_WAVELENGTH = 2.5;        // world units
const DASH_WORLD = 1.0;             // world units for running-line dash
const GAP_WORLD = 0.6;              // world units for running-line gap
const ANNOTATION_OPACITY = 0.82;    // subtle transparency so coach lines differ from pitch markings
const SELECTION_DASH = [6, 4];      // screen pixels
const DEFAULT_SELECTION_COLOR = THEME.accent;

// ── Helpers ──

/** Trace a corridor (stadium/discorectangle) path: rect with semicircle caps centered on s1 and s2. */
function drawCorridorPath(
  ctx: CanvasRenderingContext2D,
  s1: { x: number; y: number },
  s2: { x: number; y: number },
  capRadius: number,
  angle: number,
  _dist: number,
): void {
  // Perpendicular direction
  const px = -Math.sin(angle) * capRadius;
  const py =  Math.cos(angle) * capRadius;

  // Build stadium/discorectangle path
  ctx.beginPath();
  ctx.moveTo(s1.x + px, s1.y + py);
  ctx.lineTo(s2.x + px, s2.y + py);
  // Semicircle cap around s2 (away from s1)
  ctx.arc(s2.x, s2.y, capRadius, angle + Math.PI / 2, angle - Math.PI / 2, true);
  ctx.lineTo(s1.x - px, s1.y - py);
  // Semicircle cap around s1 (away from s2)
  ctx.arc(s1.x, s1.y, capRadius, angle - Math.PI / 2, angle + Math.PI / 2, true);
  ctx.closePath();
}

/** Draw a filled + stroked corridor shape. */
function drawCorridor(
  ctx: CanvasRenderingContext2D,
  s1: { x: number; y: number },
  s2: { x: number; y: number },
  capRadius: number,
  angle: number,
  dist: number,
  fillStyle: string,
  strokeStyle: string,
  lineWidth: number,
): void {
  ctx.save();
  drawCorridorPath(ctx, s1, s2, capRadius, angle, dist);
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.restore();
}

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: string,
) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const len = ARROW_HEAD_LEN;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(
    to.x - len * Math.cos(angle - Math.PI / 6),
    to.y - len * Math.sin(angle - Math.PI / 6),
  );
  ctx.lineTo(
    to.x - len * Math.cos(angle + Math.PI / 6),
    to.y - len * Math.sin(angle + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawStraightLine(
  ctx: CanvasRenderingContext2D,
  transform: PitchTransform,
  start: WorldPoint,
  end: WorldPoint,
  color: string,
  dash: number[],
  withArrow: boolean,
) {
  const s = transform.worldToScreen(start.x, start.y);
  const e = transform.worldToScreen(end.x, end.y);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = LINE_WIDTH_WORLD * transform.scale;
  ctx.lineCap = 'round';
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.lineTo(e.x, e.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  if (withArrow) {
    drawArrowhead(ctx, s, e, color);
  }
}

function drawWavyLine(
  ctx: CanvasRenderingContext2D,
  transform: PitchTransform,
  start: WorldPoint,
  end: WorldPoint,
  color: string,
) {
  const s = transform.worldToScreen(start.x, start.y);
  const e = transform.worldToScreen(end.x, end.y);

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length < 0.01) return;

  // Direction and perpendicular in world space
  const dirX = dx / length;
  const dirY = dy / length;

  // Number of half-waves
  const halfWaves = Math.max(2, Math.round(length / (WAVY_WAVELENGTH / 2)));
  const step = length / halfWaves;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = LINE_WIDTH_WORLD * transform.scale;
  ctx.lineCap = 'round';
  ctx.setLineDash([]);
  ctx.beginPath();

  const startScreen = transform.worldToScreen(start.x, start.y);
  ctx.moveTo(startScreen.x, startScreen.y);

  for (let i = 0; i < halfWaves; i++) {
    const t1 = (i + 0.5) * step; // control point along path
    const t2 = (i + 1) * step;   // end point of this segment

    const side = i % 2 === 0 ? 1 : -1;
    const amp = WAVY_AMPLITUDE * side;

    // Control point: midpoint + perpendicular offset
    const cpWorld = {
      x: start.x + dirX * t1 + (-dirY) * amp,
      y: start.y + dirY * t1 + dirX * amp,
    };
    // End of this segment
    const epWorld = {
      x: start.x + dirX * t2,
      y: start.y + dirY * t2,
    };

    const cp = transform.worldToScreen(cpWorld.x, cpWorld.y);
    const ep = transform.worldToScreen(epWorld.x, epWorld.y);
    ctx.quadraticCurveTo(cp.x, cp.y, ep.x, ep.y);
  }

  ctx.stroke();
  ctx.restore();

  // Arrowhead at end
  drawArrowhead(ctx, s, e, color);
}

/**
 * Offset endpoints from snapped players along the curve tangent so
 * the line emerges cleanly from the player centre rather than shifting sideways.
 */
function offsetCurvedEndpoints(
  start: WorldPoint,
  end: WorldPoint,
  startSnapped: boolean,
  endSnapped: boolean,
  playerRadius: number,
  direction: 'left' | 'right' = 'left',
): { start: WorldPoint; end: WorldPoint } {
  const cp = curvedRunControlPoint(start, end, direction);
  const offset = playerRadius + 0.3;

  let newStart = start;
  if (startSnapped) {
    // Tangent at t=0 is direction from start → control point
    const tdx = cp.x - start.x;
    const tdy = cp.y - start.y;
    const tlen = Math.sqrt(tdx * tdx + tdy * tdy);
    if (tlen > 0.01) {
      newStart = { x: start.x + (tdx / tlen) * offset, y: start.y + (tdy / tlen) * offset };
    }
  }

  let newEnd = end;
  if (endSnapped) {
    // Tangent at t=1 is direction from control point → end
    const tdx = end.x - cp.x;
    const tdy = end.y - cp.y;
    const tlen = Math.sqrt(tdx * tdx + tdy * tdy);
    if (tlen > 0.01) {
      newEnd = { x: end.x - (tdx / tlen) * offset, y: end.y - (tdy / tlen) * offset };
    }
  }

  return { start: newStart, end: newEnd };
}

function drawCurvedLine(
  ctx: CanvasRenderingContext2D,
  transform: PitchTransform,
  start: WorldPoint,
  end: WorldPoint,
  color: string,
  direction: 'left' | 'right' = 'left',
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length < 0.01) return;

  const cpWorld = curvedRunControlPoint(start, end, direction);

  const s = transform.worldToScreen(start.x, start.y);
  const e = transform.worldToScreen(end.x, end.y);
  const cp = transform.worldToScreen(cpWorld.x, cpWorld.y);

  const dashScreen = [DASH_WORLD * transform.scale, GAP_WORLD * transform.scale];

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = LINE_WIDTH_WORLD * transform.scale;
  ctx.lineCap = 'round';
  ctx.setLineDash(dashScreen);
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.quadraticCurveTo(cp.x, cp.y, e.x, e.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Arrowhead: tangent at endpoint of quadratic bezier
  // Tangent at t=1 is from control point to end point
  drawArrowhead(ctx, cp, e, color);
}

// ── Split-rendering helpers for progressive run animation ──

function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * De Casteljau subdivision of a quadratic bezier at parameter t.
 * Returns two sub-curves: [firstHalf, secondHalf].
 */
function splitQuadraticBezier(
  p0: WorldPoint,
  p1: WorldPoint, // control point
  p2: WorldPoint,
  t: number,
): [
  { start: WorldPoint; control: WorldPoint; end: WorldPoint },
  { start: WorldPoint; control: WorldPoint; end: WorldPoint },
] {
  const q0: WorldPoint = { x: lerpNum(p0.x, p1.x, t), y: lerpNum(p0.y, p1.y, t) };
  const q1: WorldPoint = { x: lerpNum(p1.x, p2.x, t), y: lerpNum(p1.y, p2.y, t) };
  const r: WorldPoint = { x: lerpNum(q0.x, q1.x, t), y: lerpNum(q0.y, q1.y, t) };

  return [
    { start: p0, control: q0, end: r },
    { start: r, control: q1, end: p2 },
  ];
}

/** Draw a single quadratic bezier sub-curve segment (dashed running-line style) */
function drawCurvedSegment(
  ctx: CanvasRenderingContext2D,
  transform: PitchTransform,
  start: WorldPoint,
  control: WorldPoint,
  end: WorldPoint,
  color: string,
  withArrow: boolean,
) {
  const s = transform.worldToScreen(start.x, start.y);
  const e = transform.worldToScreen(end.x, end.y);
  const cp = transform.worldToScreen(control.x, control.y);
  const dashScreen = [DASH_WORLD * transform.scale, GAP_WORLD * transform.scale];

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = LINE_WIDTH_WORLD * transform.scale;
  ctx.lineCap = 'round';
  ctx.setLineDash(dashScreen);
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.quadraticCurveTo(cp.x, cp.y, e.x, e.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  if (withArrow) {
    drawArrowhead(ctx, cp, e, color);
  }
}

function drawSelectionOutline(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  closed: boolean,
  selectionColor: string = DEFAULT_SELECTION_COLOR,
) {
  if (points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = selectionColor;
  ctx.lineWidth = 2;
  ctx.setLineDash(SELECTION_DASH);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  if (closed) ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function resolvePlayerPositions(
  playerIds: string[],
  players: Player[],
  transform: PitchTransform,
): { world: WorldPoint; screen: { x: number; y: number } }[] {
  const result: { world: WorldPoint; screen: { x: number; y: number } }[] = [];
  for (const id of playerIds) {
    const p = players.find(pl => pl.id === id);
    if (p) {
      result.push({
        world: { x: p.x, y: p.y },
        screen: transform.worldToScreen(p.x, p.y),
      });
    }
  }
  return result;
}

// ── Line endpoint resolution helpers ──

function resolveLineEndpoints(
  ann: PassingLineAnnotation | RunningLineAnnotation | CurvedRunAnnotation | DribbleLineAnnotation,
  players: Player[],
  previewGhosts: PreviewGhost[] = [],
): { start: WorldPoint; end: WorldPoint; startSnapped: boolean; endSnapped: boolean } {
  let start = ann.start;
  let end = ann.end;
  let startSnapped = false;
  let endSnapped = false;

  if (ann.startPlayerId) {
    // Check if start is from a preview ghost (future position) vs real player
    const pg = findClosestGhost(previewGhosts, ann.startPlayerId, ann.start);
    const p = players.find(pl => pl.id === ann.startPlayerId);
    if (pg && p) {
      const dxReal = ann.start.x - p.x;
      const dyReal = ann.start.y - p.y;
      const distReal = dxReal * dxReal + dyReal * dyReal;
      const dxGhost = ann.start.x - pg.x;
      const dyGhost = ann.start.y - pg.y;
      const distGhost = dxGhost * dxGhost + dyGhost * dyGhost;
      start = distGhost < distReal ? { x: pg.x, y: pg.y } : { x: p.x, y: p.y };
      startSnapped = true;
    } else if (pg) {
      start = { x: pg.x, y: pg.y }; startSnapped = true;
    } else if (p) {
      start = { x: p.x, y: p.y }; startSnapped = true;
    }
  }
  if (ann.endPlayerId) {
    // Check if a preview ghost exists for this player — if the annotation endpoint
    // was drawn to the ghost (future position), use the ghost position instead of
    // the real player's current position.
    const pg = findClosestGhost(previewGhosts, ann.endPlayerId, ann.end);
    const p = players.find(pl => pl.id === ann.endPlayerId);
    if (pg && p) {
      // Decide which position the annotation was snapped to:
      // compare stored ann.end to both the real player and the preview ghost.
      const dxReal = ann.end.x - p.x;
      const dyReal = ann.end.y - p.y;
      const distReal = dxReal * dxReal + dyReal * dyReal;
      const dxGhost = ann.end.x - pg.x;
      const dyGhost = ann.end.y - pg.y;
      const distGhost = dxGhost * dxGhost + dyGhost * dyGhost;
      if (distGhost < distReal) {
        end = { x: pg.x, y: pg.y };
      } else {
        end = { x: p.x, y: p.y };
      }
      endSnapped = true;
    } else if (pg) {
      end = { x: pg.x, y: pg.y }; endSnapped = true;
    } else if (p) {
      end = { x: p.x, y: p.y }; endSnapped = true;
    }
  }

  // For lines without endPlayerId (e.g. running-line, curved-run),
  // check if the endpoint lands on a preview ghost — treat as snapped so the
  // line stops at the ghost circle edge instead of the center.
  if (!endSnapped && previewGhosts.length > 0) {
    const SNAP_THRESHOLD = 0.5; // world units — tight check (ghost was the click target)
    for (const pg of previewGhosts) {
      const dx = end.x - pg.x;
      const dy = end.y - pg.y;
      if (dx * dx + dy * dy < SNAP_THRESHOLD * SNAP_THRESHOLD) {
        end = { x: pg.x, y: pg.y };
        endSnapped = true;
        break;
      }
    }
  }

  return { start, end, startSnapped, endSnapped };
}

function offsetEndpointsFromPlayers(
  start: WorldPoint,
  end: WorldPoint,
  startSnapped: boolean,
  endSnapped: boolean,
  playerRadius: number,
): { start: WorldPoint; end: WorldPoint } {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.01) return { start, end };

  const dirX = dx / len;
  const dirY = dy / len;
  const offset = playerRadius + 0.3;

  const newStart = startSnapped
    ? { x: start.x + dirX * offset, y: start.y + dirY * offset }
    : start;
  const newEnd = endSnapped
    ? { x: end.x - dirX * offset, y: end.y - dirY * offset }
    : end;

  return { start: newStart, end: newEnd };
}

// ── Snap indicator ── (subtle ring at snapped endpoints, drawn above players)

function drawSnapIndicator(
  ctx: CanvasRenderingContext2D,
  transform: PitchTransform,
  point: WorldPoint,
  color: string,
  playerRadius: number,
) {
  const screen = transform.worldToScreen(point.x, point.y);
  const r = playerRadius * transform.scale + 5;
  ctx.save();
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, r, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.stroke();
  ctx.restore();
}

// ── Step badge helper ──

function drawStepBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  step: number,
  color: string,
  focused: boolean = false,
) {
  const radius = 8;
  ctx.save();
  // Focused glow ring
  if (focused) {
    ctx.beginPath();
    ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Background circle
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = focused ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.75)';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = focused ? 2 : 1.5;
  ctx.stroke();
  // Number text
  ctx.font = 'bold 10px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(String(step), x, y + 0.5);
  ctx.restore();
}

/**
 * Check if annotations have multiple distinct step numbers.
 * Only show step badges when there are 2+ distinct steps.
 */
function hasMultipleSteps(annotations: Annotation[]): boolean {
  const steps = new Set<number>();
  for (const ann of annotations) {
    if (ann.type === 'passing-line' || ann.type === 'running-line' || ann.type === 'curved-run' || ann.type === 'dribble-line') {
      steps.add(ann.animStep ?? 1);
      if (steps.size > 1) return true;
    }
  }
  return false;
}

// ── Public exports ──

/**
 * Render lines and polygons (below players).
 */
// Ghost fade constants (must match renderPipeline.ts)
const GHOST_HOLD_MS = 200;
const GHOST_FADE_MS = 800;

export function renderAnnotationsBase(
  ctx: CanvasRenderingContext2D,
  transform: PitchTransform,
  annotations: Annotation[],
  players: Player[],
  selectedAnnotationId: string | null,
  playerRadius: number = 1.6,
  accent: string = THEME.accent,
  ghostAnnotationIds: string[] = [],
  runAnimOverlays?: RunAnimationOverlay[],
  ghostPlayers: GhostPlayer[] = [],
  previewGhosts: PreviewGhost[] = [],
  now?: number,
  effectiveSteps?: Map<string, number>,
  showStepNumbers: boolean = true,
): void {
  const showStepBadges = showStepNumbers;

  ctx.save();
  ctx.globalAlpha = ANNOTATION_OPACITY;

  for (const ann of annotations) {
    const isSelected = ann.id === selectedAnnotationId;
    const isGhostAnn = ghostAnnotationIds.includes(ann.id);
    const runAnimOverlay = runAnimOverlays?.find(o => o.annotationId === ann.id);
    const isAnimating = !!runAnimOverlay;

    // For ghost annotations whose startPlayerId has moved away,
    // substitute the player position with the ghost player's original position.
    // This ensures the ghost line renders from origin → destination, not from current player pos.
    let playersForGhost = players;
    if (isGhostAnn && !isAnimating) {
      const annWithStart = ann as { startPlayerId?: string };
      if (annWithStart.startPlayerId) {
        const ghost = ghostPlayers.find(g => g.playerId === annWithStart.startPlayerId);
        if (ghost) {
          playersForGhost = players.map(p =>
            p.id === ghost.playerId
              ? { ...p, x: ghost.x, y: ghost.y }
              : p
          );
        }
      }
    }

    // Ghost annotations are rendered at very low opacity, fading over time
    // (but skip if this annotation is being actively animated — split rendering handles it)
    if (isGhostAnn && !isAnimating) {
      let annOpacity = 0.15;
      // Find the ghost player associated with this annotation to sync fade timing
      const annWithStart = ann as { startPlayerId?: string };
      const fadeGhost = annWithStart.startPlayerId
        ? ghostPlayers.find(g => g.playerId === annWithStart.startPlayerId)
        : undefined;
      if (fadeGhost && fadeGhost.createdAt > 0 && now) {
        const elapsed = now - fadeGhost.createdAt;
        if (elapsed > GHOST_HOLD_MS) {
          const fadeProgress = Math.min(1, (elapsed - GHOST_HOLD_MS) / GHOST_FADE_MS);
          annOpacity = 0.15 * (1 - fadeProgress);
        }
      }
      if (annOpacity <= 0.001) continue; // fully faded — skip rendering
      ctx.save();
      ctx.globalAlpha = annOpacity;
    }

    switch (ann.type) {
      case 'passing-line': {
        // Use ghost/overlay positions so the line stays anchored at the origin
        const passResolvedPlayers = isAnimating && runAnimOverlay
          ? players.map(p => p.id === runAnimOverlay.playerId
              ? { ...p, x: runAnimOverlay.ghostPlayer.x, y: runAnimOverlay.ghostPlayer.y }
              : p)
          : playersForGhost;
        const resolved = resolveLineEndpoints(ann, passResolvedPlayers, previewGhosts);
        const offset = offsetEndpointsFromPlayers(resolved.start, resolved.end, resolved.startSnapped, resolved.endSnapped, playerRadius);

        if (isAnimating && runAnimOverlay) {
          // Progressive fade: split line at animation progress
          const p = runAnimOverlay.progress;
          const splitPt: WorldPoint = {
            x: lerpNum(offset.start.x, offset.end.x, p),
            y: lerpNum(offset.start.y, offset.end.y, p),
          };
          // Behind ball → ghost opacity
          ctx.save();
          ctx.globalAlpha = 0.15;
          drawStraightLine(ctx, transform, offset.start, splitPt, ann.color, [], false);
          ctx.restore();
          // Ahead of ball → full opacity
          drawStraightLine(ctx, transform, splitPt, offset.end, ann.color, [], true);
        } else {
          drawStraightLine(ctx, transform, offset.start, offset.end, ann.color, [], true);
        }

        if (isSelected) {
          const s = transform.worldToScreen(resolved.start.x, resolved.start.y);
          const e = transform.worldToScreen(resolved.end.x, resolved.end.y);
          drawSelectionOutline(ctx, [s, e], false, accent);
        }
        if (showStepBadges && !isGhostAnn && !isAnimating) {
          const midX = (resolved.start.x + resolved.end.x) / 2;
          const midY = (resolved.start.y + resolved.end.y) / 2;
          const badgePos = transform.worldToScreen(midX, midY);
          drawStepBadge(ctx, badgePos.x, badgePos.y - 12, effectiveSteps?.get(ann.id) ?? ann.animStep ?? 1, ann.color, ann.id === selectedAnnotationId);
        }
        break;
      }
      case 'running-line': {
        // Use ghost/overlay positions so the line stays anchored at the origin,
        // not the player's current (moved) position.
        const resolvedPlayers = isAnimating && runAnimOverlay
          ? players.map(p => p.id === runAnimOverlay.playerId
              ? { ...p, x: runAnimOverlay.ghostPlayer.x, y: runAnimOverlay.ghostPlayer.y }
              : p)
          : playersForGhost;
        const resolved = resolveLineEndpoints(ann, resolvedPlayers, previewGhosts);
        const offset = offsetEndpointsFromPlayers(resolved.start, resolved.end, resolved.startSnapped, resolved.endSnapped, playerRadius);
        const dashScreen = [DASH_WORLD * transform.scale, GAP_WORLD * transform.scale];

        if (isAnimating && runAnimOverlay) {
          // Progressive fade: split line at animation progress
          const p = runAnimOverlay.progress;
          const splitPt: WorldPoint = {
            x: lerpNum(offset.start.x, offset.end.x, p),
            y: lerpNum(offset.start.y, offset.end.y, p),
          };
          // Behind player → ghost opacity
          ctx.save();
          ctx.globalAlpha = 0.15;
          drawStraightLine(ctx, transform, offset.start, splitPt, ann.color, dashScreen, false);
          ctx.restore();
          // Ahead of player → full annotation opacity
          drawStraightLine(ctx, transform, splitPt, offset.end, ann.color, dashScreen, true);
        } else {
          drawStraightLine(ctx, transform, offset.start, offset.end, ann.color, dashScreen, true);
        }

        if (isSelected) {
          const s = transform.worldToScreen(resolved.start.x, resolved.start.y);
          const e = transform.worldToScreen(resolved.end.x, resolved.end.y);
          drawSelectionOutline(ctx, [s, e], false, accent);
        }
        if (showStepBadges && !isGhostAnn && !isAnimating) {
          const midX = (resolved.start.x + resolved.end.x) / 2;
          const midY = (resolved.start.y + resolved.end.y) / 2;
          const badgePos = transform.worldToScreen(midX, midY);
          drawStepBadge(ctx, badgePos.x, badgePos.y - 12, effectiveSteps?.get(ann.id) ?? ann.animStep ?? 1, ann.color, ann.id === selectedAnnotationId);
        }
        break;
      }
      case 'curved-run': {
        // Use ghost/overlay positions so the line stays anchored at the origin,
        // not the player's current (moved) position.
        const curvedResolvedPlayers = isAnimating && runAnimOverlay
          ? players.map(p => p.id === runAnimOverlay.playerId
              ? { ...p, x: runAnimOverlay.ghostPlayer.x, y: runAnimOverlay.ghostPlayer.y }
              : p)
          : playersForGhost;
        const resolved = resolveLineEndpoints(ann, curvedResolvedPlayers, previewGhosts);
        const dir = ann.curveDirection ?? 'left';
        const offset = offsetCurvedEndpoints(resolved.start, resolved.end, resolved.startSnapped, resolved.endSnapped, playerRadius, dir);

        if (isAnimating && runAnimOverlay) {
          // Progressive fade: split bezier at animation progress
          const cpWorld = curvedRunControlPoint(offset.start, offset.end, dir);
          const [first, second] = splitQuadraticBezier(offset.start, cpWorld, offset.end, runAnimOverlay.progress);
          // Behind player → ghost opacity
          ctx.save();
          ctx.globalAlpha = 0.15;
          drawCurvedSegment(ctx, transform, first.start, first.control, first.end, ann.color, false);
          ctx.restore();
          // Ahead of player → full annotation opacity + arrowhead
          drawCurvedSegment(ctx, transform, second.start, second.control, second.end, ann.color, true);
        } else {
          drawCurvedLine(ctx, transform, offset.start, offset.end, ann.color, dir);
        }

        if (isSelected) {
          const s = transform.worldToScreen(resolved.start.x, resolved.start.y);
          const e = transform.worldToScreen(resolved.end.x, resolved.end.y);
          drawSelectionOutline(ctx, [s, e], false, accent);
        }
        if (showStepBadges && !isGhostAnn && !isAnimating) {
          const midX = (resolved.start.x + resolved.end.x) / 2;
          const midY = (resolved.start.y + resolved.end.y) / 2;
          const badgePos = transform.worldToScreen(midX, midY);
          drawStepBadge(ctx, badgePos.x, badgePos.y - 12, effectiveSteps?.get(ann.id) ?? ann.animStep ?? 1, ann.color, ann.id === selectedAnnotationId);
        }
        break;
      }
      case 'dribble-line': {
        // Use ghost/overlay positions so the line stays anchored at the origin
        const dribbleResolvedPlayers = isAnimating && runAnimOverlay
          ? players.map(p => p.id === runAnimOverlay.playerId
              ? { ...p, x: runAnimOverlay.ghostPlayer.x, y: runAnimOverlay.ghostPlayer.y }
              : p)
          : playersForGhost;
        const resolved = resolveLineEndpoints(ann, dribbleResolvedPlayers, previewGhosts);
        const offset = offsetEndpointsFromPlayers(resolved.start, resolved.end, resolved.startSnapped, resolved.endSnapped, playerRadius);

        if (isAnimating && runAnimOverlay) {
          // Progressive fade using canvas clipping:
          // Split point in world coords
          const p = runAnimOverlay.progress;
          const splitWorld: WorldPoint = {
            x: lerpNum(offset.start.x, offset.end.x, p),
            y: lerpNum(offset.start.y, offset.end.y, p),
          };
          const splitScreen = transform.worldToScreen(splitWorld.x, splitWorld.y);
          const startScreen = transform.worldToScreen(offset.start.x, offset.start.y);
          const endScreen = transform.worldToScreen(offset.end.x, offset.end.y);

          // Direction perpendicular to the line (for clipping rectangle)
          const ldx = endScreen.x - startScreen.x;
          const ldy = endScreen.y - startScreen.y;
          const lineLen = Math.sqrt(ldx * ldx + ldy * ldy);
          const clipPad = lineLen + 50; // generous padding

          // Behind player → ghost opacity (clip from start to split)
          ctx.save();
          ctx.globalAlpha = 0.15;
          ctx.beginPath();
          if (lineLen > 0) {
            const perpX = -ldy / lineLen;
            const perpY = ldx / lineLen;
            ctx.moveTo(startScreen.x + perpX * clipPad, startScreen.y + perpY * clipPad);
            ctx.lineTo(startScreen.x - perpX * clipPad, startScreen.y - perpY * clipPad);
            ctx.lineTo(splitScreen.x - perpX * clipPad, splitScreen.y - perpY * clipPad);
            ctx.lineTo(splitScreen.x + perpX * clipPad, splitScreen.y + perpY * clipPad);
          }
          ctx.clip();
          drawWavyLine(ctx, transform, offset.start, offset.end, ann.color);
          ctx.restore();

          // Ahead of player → full opacity (clip from split to end)
          ctx.save();
          ctx.beginPath();
          if (lineLen > 0) {
            const perpX = -ldy / lineLen;
            const perpY = ldx / lineLen;
            ctx.moveTo(splitScreen.x + perpX * clipPad, splitScreen.y + perpY * clipPad);
            ctx.lineTo(splitScreen.x - perpX * clipPad, splitScreen.y - perpY * clipPad);
            ctx.lineTo(endScreen.x - perpX * clipPad, endScreen.y - perpY * clipPad);
            ctx.lineTo(endScreen.x + perpX * clipPad, endScreen.y + perpY * clipPad);
          }
          ctx.clip();
          drawWavyLine(ctx, transform, offset.start, offset.end, ann.color);
          ctx.restore();
        } else {
          drawWavyLine(ctx, transform, offset.start, offset.end, ann.color);
        }

        if (isSelected) {
          const s = transform.worldToScreen(resolved.start.x, resolved.start.y);
          const e = transform.worldToScreen(resolved.end.x, resolved.end.y);
          drawSelectionOutline(ctx, [s, e], false, accent);
        }
        if (showStepBadges && !isGhostAnn && !isAnimating) {
          const midX = (resolved.start.x + resolved.end.x) / 2;
          const midY = (resolved.start.y + resolved.end.y) / 2;
          const badgePos = transform.worldToScreen(midX, midY);
          drawStepBadge(ctx, badgePos.x, badgePos.y - 12, effectiveSteps?.get(ann.id) ?? ann.animStep ?? 1, ann.color, ann.id === selectedAnnotationId);
        }
        break;
      }
      case 'polygon': {
        if (ann.points.length < 3) break;
        const screenPts = ann.points.map(p => transform.worldToScreen(p.x, p.y));
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(screenPts[0].x, screenPts[0].y);
        for (let i = 1; i < screenPts.length; i++) {
          ctx.lineTo(screenPts[i].x, screenPts[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = hexToRgba(ann.fillColor, ann.fillOpacity);
        ctx.fill();
        ctx.strokeStyle = ann.strokeColor;
        ctx.lineWidth = 0.3 * transform.scale;
        ctx.setLineDash([]);
        ctx.stroke();
        ctx.restore();
        if (isSelected) {
          drawSelectionOutline(ctx, screenPts, true, accent);
        }
        break;
      }
      case 'player-polygon': {
        const positions = resolvePlayerPositions(ann.playerIds, players, transform);
        if (positions.length < 3) break;
        const screenPts = positions.map(p => p.screen);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(screenPts[0].x, screenPts[0].y);
        for (let i = 1; i < screenPts.length; i++) {
          ctx.lineTo(screenPts[i].x, screenPts[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = hexToRgba(ann.fillColor, ann.fillOpacity);
        ctx.fill();
        ctx.strokeStyle = ann.strokeColor;
        ctx.lineWidth = 0.3 * transform.scale;
        ctx.setLineDash([]);
        ctx.stroke();
        ctx.restore();
        if (isSelected) {
          drawSelectionOutline(ctx, screenPts, true, accent);
        }
        break;
      }
      case 'player-line': {
        const positions = resolvePlayerPositions(ann.playerIds, players, transform);
        if (positions.length < 2) break;
        const screenPts = positions.map(p => p.screen);
        const lw = ann.lineWidth * transform.scale;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([]);
        // Black stroke (outline)
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = lw + 6;
        ctx.beginPath();
        ctx.moveTo(screenPts[0].x, screenPts[0].y);
        for (let i = 1; i < screenPts.length; i++) {
          ctx.lineTo(screenPts[i].x, screenPts[i].y);
        }
        ctx.stroke();
        // White fill (inner)
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(screenPts[0].x, screenPts[0].y);
        for (let i = 1; i < screenPts.length; i++) {
          ctx.lineTo(screenPts[i].x, screenPts[i].y);
        }
        ctx.stroke();
        ctx.restore();
        if (isSelected) {
          drawSelectionOutline(ctx, screenPts, false, accent);
        }
        break;
      }
      case 'ellipse': {
        const center = transform.worldToScreen(ann.center.x, ann.center.y);
        const rx = ann.radiusX * transform.scale;
        const ry = ann.radiusY * transform.scale;
        if (rx < 0.5 && ry < 0.5) break;
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(center.x, center.y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(ann.fillColor, ann.fillOpacity);
        ctx.fill();
        ctx.strokeStyle = ann.strokeColor;
        ctx.lineWidth = 0.3 * transform.scale;
        ctx.setLineDash([]);
        ctx.stroke();
        ctx.restore();
        if (isSelected) {
          ctx.save();
          ctx.strokeStyle = accent;
          ctx.lineWidth = 2;
          ctx.setLineDash(SELECTION_DASH);
          ctx.beginPath();
          ctx.ellipse(center.x, center.y, rx + 3, ry + 3, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
        break;
      }
      case 'player-marking': {
        const p1 = players.find(p => p.id === ann.markedPlayerId);
        const p2 = players.find(p => p.id === ann.markingPlayerId);
        if (!p1 || !p2) break;

        const s1 = transform.worldToScreen(p1.x, p1.y);
        const s2 = transform.worldToScreen(p2.x, p2.y);
        const dx = s2.x - s1.x;
        const dy = s2.y - s1.y;
        const screenDist = Math.sqrt(dx * dx + dy * dy);
        if (screenDist < 0.5) break;

        // Corridor = rectangle with semicircle caps (encloses player circles with comfortable padding)
        const capRadius = playerRadius * transform.scale + 6;
        const screenAngle = Math.atan2(dy, dx);

        drawCorridor(ctx, s1, s2, capRadius, screenAngle, screenDist,
          hexToRgba(ann.fillColor, ann.fillOpacity), ann.strokeColor,
          Math.max(2, 0.3 * transform.scale));

        // Double-ended dashed arrow connecting the players
        {
          const cosA = Math.cos(screenAngle);
          const sinA = Math.sin(screenAngle);
          // Offset arrow tips to the edge of each player circle so they're visible
          const playerScreenR = playerRadius * transform.scale + 2;
          const tip1x = s1.x + cosA * playerScreenR;
          const tip1y = s1.y + sinA * playerScreenR;
          const tip2x = s2.x - cosA * playerScreenR;
          const tip2y = s2.y - sinA * playerScreenR;
          const headLen = Math.min(screenDist * 0.15, 10);

          ctx.save();
          ctx.strokeStyle = '#000000';
          ctx.globalAlpha = 0.45;
          ctx.lineWidth = Math.max(1, 0.1 * transform.scale);
          // Dashed shaft between the two tips
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(tip1x, tip1y);
          ctx.lineTo(tip2x, tip2y);
          ctx.stroke();
          // Arrowheads (solid) — tips point at each player
          ctx.setLineDash([]);
          ctx.lineWidth = Math.max(1.5, 0.12 * transform.scale);
          // Head at tip1 (pointing toward s1/player1)
          ctx.beginPath();
          ctx.moveTo(tip1x + cosA * headLen - sinA * headLen * 0.5,
                     tip1y + sinA * headLen + cosA * headLen * 0.5);
          ctx.lineTo(tip1x, tip1y);
          ctx.lineTo(tip1x + cosA * headLen + sinA * headLen * 0.5,
                     tip1y + sinA * headLen - cosA * headLen * 0.5);
          ctx.stroke();
          // Head at tip2 (pointing toward s2/player2)
          ctx.beginPath();
          ctx.moveTo(tip2x - cosA * headLen - sinA * headLen * 0.5,
                     tip2y - sinA * headLen + cosA * headLen * 0.5);
          ctx.lineTo(tip2x, tip2y);
          ctx.lineTo(tip2x - cosA * headLen + sinA * headLen * 0.5,
                     tip2y - sinA * headLen - cosA * headLen * 0.5);
          ctx.stroke();
          ctx.restore();
        }

        // Selection highlight
        if (isSelected) {
          ctx.save();
          ctx.strokeStyle = accent;
          ctx.lineWidth = 2;
          ctx.setLineDash(SELECTION_DASH);
          drawCorridorPath(ctx, s1, s2, capRadius + 3, screenAngle, screenDist);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
        break;
      }
      // text is rendered in a separate pass
      default:
        break;
    }

    // Restore ghost annotation opacity
    if (isGhostAnn && !isAnimating) {
      ctx.restore();
    }
  }

  ctx.restore();
}

/**
 * Render text annotations (above players).
 */
export function renderAnnotationsText(
  ctx: CanvasRenderingContext2D,
  transform: PitchTransform,
  annotations: Annotation[],
  selectedAnnotationId: string | null,
  accent: string = THEME.accent,
): void {
  for (const ann of annotations) {
    if (ann.type !== 'text') continue;
    const isSelected = ann.id === selectedAnnotationId;

    const pos = transform.worldToScreen(ann.position.x, ann.position.y);
    const fontSize = Math.max(10, ann.fontSize * transform.scale);
    ctx.save();
    ctx.font = `500 ${fontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const metrics = ctx.measureText(ann.text);
    const textW = metrics.width;
    const textH = fontSize;
    const px = 6;
    const py = 3;

    // Background pill
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(pos.x - textW / 2 - px, pos.y - textH / 2 - py, textW + px * 2, textH + py * 2, 4);
    ctx.fill();

    // Text
    ctx.fillStyle = ann.color;
    ctx.fillText(ann.text, pos.x, pos.y);
    ctx.restore();

    // Selection outline
    if (isSelected) {
      const left = pos.x - textW / 2 - px - 2;
      const top = pos.y - textH / 2 - py - 2;
      const w = textW + px * 2 + 4;
      const h = textH + py * 2 + 4;
      ctx.save();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.setLineDash(SELECTION_DASH);
      ctx.strokeRect(left, top, w, h);
      ctx.setLineDash([]);
      ctx.restore();
    }
  }
}

/**
 * Render the in-progress drawing preview (topmost layer).
 */
export function renderDrawingPreview(
  ctx: CanvasRenderingContext2D,
  transform: PitchTransform,
  drawing: DrawingInProgress,
  mouseWorld: WorldPoint | null,
  players: Player[],
  _drawSubTool: DrawSubTool,
  playerRadius: number = 1.6,
  accent: string = THEME.accent,
  shiftHeld: boolean = false,
  previewGhosts: PreviewGhost[] = [],
): void {
  const previewColor = hexToRgba(accent, 0.7); // accent ghost

  switch (drawing.type) {
    case 'line': {
      if (!mouseWorld) break;

      // Check if start is snapped to a player or preview ghost — draw highlight ring
      if (drawing.startPlayerId) {
        let startPos: { x: number; y: number } | null = null;
        if (drawing.startFromGhost) {
          const ghost = findClosestGhost(previewGhosts, drawing.startPlayerId!, drawing.start);
          if (ghost) startPos = { x: ghost.x, y: ghost.y };
        }
        if (!startPos) {
          const startPlayer = players.find(p => p.id === drawing.startPlayerId);
          if (startPlayer) startPos = { x: startPlayer.x, y: startPlayer.y };
        }
        if (startPos) {
          const sp = transform.worldToScreen(startPos.x, startPos.y);
          ctx.save();
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, 6, 0, Math.PI * 2);
          ctx.strokeStyle = previewColor;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        }
      }

      // Check if mouse is near a player for end-snap preview
      // Running-line and dribble-line don't snap at the end (destination only)
      const noEndSnap = drawing.subTool === 'running-line' || drawing.subTool === 'dribble-line';
      let effectiveEnd = mouseWorld;
      let endSnapPlayer: Player | null = null;
      if (!noEndSnap) {
        // Include preview ghosts as snap targets (real players checked first = higher priority)
        const snapTargets: Array<{ id: string; x: number; y: number; team: 'A' | 'B'; number: number; name: string; facing: number; isGK?: boolean }> = [
          ...players,
          ...previewGhosts.map(g => ({ id: g.playerId, team: g.team, number: g.number, name: g.name, x: g.x, y: g.y, facing: g.facing, isGK: g.isGK })),
        ];
        const snapDist = playerRadius + 1;
        for (const p of snapTargets) {
          if (p.id === drawing.startPlayerId) continue; // don't snap to same player
          const dx = mouseWorld.x - p.x;
          const dy = mouseWorld.y - p.y;
          if (dx * dx + dy * dy < snapDist * snapDist) {
            endSnapPlayer = p as Player;
            effectiveEnd = { x: p.x, y: p.y };
            break;
          }
        }
      }

      const dash = drawing.subTool === 'running-line'
        ? [DASH_WORLD * transform.scale, GAP_WORLD * transform.scale]
        : [];
      if (drawing.subTool === 'curved-run') {
        drawCurvedLine(ctx, transform, drawing.start, effectiveEnd, previewColor, shiftHeld ? 'right' : 'left');
      } else if (drawing.subTool === 'dribble-line') {
        drawWavyLine(ctx, transform, drawing.start, effectiveEnd, previewColor);
      } else {
        drawStraightLine(ctx, transform, drawing.start, effectiveEnd, previewColor, dash, true);
      }

      // Draw end-snap indicator ring
      if (endSnapPlayer) {
        const ep = transform.worldToScreen(endSnapPlayer.x, endSnapPlayer.y);
        ctx.save();
        ctx.beginPath();
        ctx.arc(ep.x, ep.y, 6, 0, Math.PI * 2);
        ctx.strokeStyle = previewColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      // Draw start point indicator (dot if not snapped, ring is drawn above if snapped)
      if (!drawing.startPlayerId) {
        const startScreen = transform.worldToScreen(drawing.start.x, drawing.start.y);
        ctx.save();
        ctx.beginPath();
        ctx.arc(startScreen.x, startScreen.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = previewColor;
        ctx.fill();
        ctx.restore();
      }
      break;
    }
    case 'polygon': {
      if (drawing.points.length === 0) break;
      const screenPts = drawing.points.map(p => transform.worldToScreen(p.x, p.y));
      ctx.save();
      ctx.strokeStyle = previewColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(screenPts[0].x, screenPts[0].y);
      for (let i = 1; i < screenPts.length; i++) {
        ctx.lineTo(screenPts[i].x, screenPts[i].y);
      }
      // Ghost edge to mouse
      if (mouseWorld) {
        const mouse = transform.worldToScreen(mouseWorld.x, mouseWorld.y);
        ctx.lineTo(mouse.x, mouse.y);
        // Ghost closing edge
        ctx.setLineDash([4, 4]);
        ctx.lineTo(screenPts[0].x, screenPts[0].y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      // Draw vertex dots
      for (const pt of screenPts) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = previewColor;
        ctx.fill();
      }
      ctx.restore();
      break;
    }
    case 'ellipse': {
      if (!mouseWorld) break;
      const center = transform.worldToScreen(drawing.center.x, drawing.center.y);
      const edge = transform.worldToScreen(mouseWorld.x, mouseWorld.y);
      const rx = Math.abs(edge.x - center.x);
      const ry = Math.abs(edge.y - center.y);
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(center.x, center.y, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(accent, 0.1);
      ctx.fill();
      ctx.strokeStyle = previewColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.stroke();
      ctx.restore();
      // Center dot
      ctx.save();
      ctx.beginPath();
      ctx.arc(center.x, center.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = previewColor;
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'player-polygon':
    case 'player-line': {
      const ids = drawing.playerIds;
      const positions = resolvePlayerPositions(ids, players, transform);
      if (positions.length === 0) break;
      const screenPts = positions.map(p => p.screen);
      ctx.save();
      ctx.strokeStyle = previewColor;
      ctx.lineWidth = drawing.type === 'player-line' ? 0.8 * transform.scale : 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(screenPts[0].x, screenPts[0].y);
      for (let i = 1; i < screenPts.length; i++) {
        ctx.lineTo(screenPts[i].x, screenPts[i].y);
      }
      // Ghost closing for polygon
      if (drawing.type === 'player-polygon' && positions.length >= 2) {
        ctx.setLineDash([4, 4]);
        ctx.lineTo(screenPts[0].x, screenPts[0].y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      // Highlight participating players
      for (const pt of screenPts) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
        ctx.strokeStyle = previewColor;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case 'player-marking': {
      const markedPlayer = players.find(p => p.id === drawing.markedPlayerId);
      if (!markedPlayer) break;

      const markedScreen = transform.worldToScreen(markedPlayer.x, markedPlayer.y);
      const redPreview = 'rgba(239, 68, 68, 0.7)';

      // Highlight ring on marked player
      const ringRadius = Math.max(8, playerRadius * transform.scale + 4);
      ctx.save();
      ctx.beginPath();
      ctx.arc(markedScreen.x, markedScreen.y, ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = redPreview;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Preview if hovering near a second player
      if (mouseWorld) {
        const snapDist = playerRadius + 1;
        let hoverPlayer: Player | null = null;
        for (const p of players) {
          if (p.id === drawing.markedPlayerId) continue;
          const ddx = mouseWorld.x - p.x;
          const ddy = mouseWorld.y - p.y;
          if (ddx * ddx + ddy * ddy < snapDist * snapDist) {
            hoverPlayer = p;
            break;
          }
        }

        if (hoverPlayer) {
          // Ghost corridor
          const s1 = markedScreen;
          const s2 = transform.worldToScreen(hoverPlayer.x, hoverPlayer.y);
          const sdx = s2.x - s1.x;
          const sdy = s2.y - s1.y;
          const sDist = Math.sqrt(sdx * sdx + sdy * sdy);

          if (sDist > 0.5) {
            const capR = playerRadius * transform.scale + 6;
            const sAngle = Math.atan2(sdy, sdx);
            drawCorridor(ctx, s1, s2, capR, sAngle, sDist,
              'rgba(239, 68, 68, 0.08)', redPreview, 2);
          }

          // Highlight ring on second player
          const hp = transform.worldToScreen(hoverPlayer.x, hoverPlayer.y);
          ctx.save();
          ctx.beginPath();
          ctx.arc(hp.x, hp.y, ringRadius, 0, Math.PI * 2);
          ctx.strokeStyle = redPreview;
          ctx.lineWidth = 2.5;
          ctx.setLineDash([4, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        } else {
          // Ghost line from marked player to cursor
          const ms = transform.worldToScreen(mouseWorld.x, mouseWorld.y);
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(markedScreen.x, markedScreen.y);
          ctx.lineTo(ms.x, ms.y);
          ctx.strokeStyle = redPreview;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
      }
      break;
    }
  }
}

/**
 * Render subtle snap indicator rings on line endpoints connected to players.
 * Called AFTER players so the rings appear above player tokens.
 */
export function renderSnapIndicators(
  ctx: CanvasRenderingContext2D,
  transform: PitchTransform,
  annotations: Annotation[],
  players: Player[],
  playerRadius: number = 1.6,
): void {
  for (const ann of annotations) {
    if (ann.type !== 'passing-line' && ann.type !== 'running-line' && ann.type !== 'curved-run' && ann.type !== 'dribble-line') continue;
    const resolved = resolveLineEndpoints(ann, players);
    if (resolved.startSnapped) drawSnapIndicator(ctx, transform, resolved.start, ann.color, playerRadius);
    if (resolved.endSnapped) drawSnapIndicator(ctx, transform, resolved.end, ann.color, playerRadius);
  }
}

// ── Utility ──

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
