import { PITCH } from '../constants/pitch';
import { THEME } from '../constants/colors';
import type { PitchSettings, PitchTransform } from '../types';

/** True when the grass is light enough that white lines would be invisible. */
function isLightPitch(grassColor: string): boolean {
  const h = grassColor.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return (r + g + b) / 3 > 160;
}

/** Resolve the adaptive pitch-line colour. */
function pitchLineColor(grassColor: string): string {
  return isLightPitch(grassColor) ? 'rgba(30, 30, 30, 0.85)' : THEME.pitchLines;
}

function setLineStyle(ctx: CanvasRenderingContext2D, transform: PitchTransform, grassColor: string) {
  ctx.strokeStyle = pitchLineColor(grassColor);
  ctx.lineWidth = Math.max(1.5, PITCH.lineWidth * transform.scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  ctx.fillStyle = THEME.pitchBackground;
  ctx.fillRect(0, 0, width, height);
}

function surroundColor(hex: string): string {
  // Compute a surround color that contrasts with the grass.
  // For mid/bright grass → darken by 18%.  For very dark grass → lighten slightly.
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const luminance = (r + g + b) / 3;
  if (luminance < 40) {
    // Very dark: lighten slightly so the surround is distinguishable
    const lift = 18;
    return `rgb(${Math.min(255, r + lift)}, ${Math.min(255, g + lift)}, ${Math.min(255, b + lift)})`;
  }
  // Normal: darken by 18%
  const factor = 0.82;
  return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`;
}

function drawGrass(ctx: CanvasRenderingContext2D, transform: PitchTransform, pitchSettings: PitchSettings) {
  // Green surround — extends into the padding area, slightly darker than pitch
  const pad = PITCH.padding;
  const surroundTL = transform.worldToScreen(-pad, -pad);
  const surroundBR = transform.worldToScreen(PITCH.length + pad, PITCH.width + pad);
  ctx.fillStyle = surroundColor(pitchSettings.grassColor);
  ctx.fillRect(surroundTL.x, surroundTL.y, surroundBR.x - surroundTL.x, surroundBR.y - surroundTL.y);

  // Main grass on the pitch itself
  const topLeft = transform.worldToScreen(0, 0);
  const bottomRight = transform.worldToScreen(PITCH.length, PITCH.width);
  ctx.fillStyle = pitchSettings.grassColor;
  ctx.fillRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);

  // Stripes — boundaries aligned to penalty area edges (16.5m)
  if (pitchSettings.stripesEnabled) {
    const pa = PITCH.penaltyAreaLength;             // 16.5m
    const mid = PITCH.length - 2 * pa;              // 72m
    const midStripes = 8;
    const midW = mid / midStripes;                   // 9m
    // Build stripe edges: 2 in each penalty area + 8 in the middle = 12 stripes
    const edges: number[] = [0, pa / 2, pa];
    for (let i = 1; i <= midStripes; i++) edges.push(pa + i * midW);
    edges.push(PITCH.length - pa / 2, PITCH.length);

    ctx.save();
    ctx.globalAlpha = pitchSettings.stripeOpacity;
    ctx.fillStyle = pitchSettings.stripeColor;
    for (let i = 1; i < edges.length - 1; i += 2) {
      const left = transform.worldToScreen(edges[i], 0);
      const right = transform.worldToScreen(edges[i + 1], PITCH.width);
      ctx.fillRect(left.x, left.y, right.x - left.x, right.y - left.y);
    }
    ctx.restore();
  }
}

function drawOuterLines(ctx: CanvasRenderingContext2D, transform: PitchTransform, gc: string) {
  setLineStyle(ctx, transform, gc);
  const tl = transform.worldToScreen(0, 0);
  const br = transform.worldToScreen(PITCH.length, PITCH.width);
  ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
}

function drawHalfwayLine(ctx: CanvasRenderingContext2D, transform: PitchTransform, gc: string) {
  setLineStyle(ctx, transform, gc);
  const top = transform.worldToScreen(PITCH.length / 2, 0);
  const bottom = transform.worldToScreen(PITCH.length / 2, PITCH.width);
  ctx.beginPath();
  ctx.moveTo(top.x, top.y);
  ctx.lineTo(bottom.x, bottom.y);
  ctx.stroke();
}

function drawCenterCircle(ctx: CanvasRenderingContext2D, transform: PitchTransform, gc: string) {
  setLineStyle(ctx, transform, gc);
  const center = transform.worldToScreen(PITCH.length / 2, PITCH.width / 2);
  const radius = PITCH.centerCircleRadius * transform.scale;

  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Center spot
  ctx.fillStyle = pitchLineColor(gc);
  ctx.beginPath();
  ctx.arc(center.x, center.y, PITCH.centerSpotRadius * transform.scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawPenaltyArea(
  ctx: CanvasRenderingContext2D,
  transform: PitchTransform,
  isLeft: boolean,
  gc: string,
) {
  setLineStyle(ctx, transform, gc);
  const areaY = (PITCH.width - PITCH.penaltyAreaWidth) / 2;

  let x: number, w: number;
  if (isLeft) {
    x = 0;
    w = PITCH.penaltyAreaLength;
  } else {
    x = PITCH.length - PITCH.penaltyAreaLength;
    w = PITCH.penaltyAreaLength;
  }

  const tl = transform.worldToScreen(x, areaY);
  const br = transform.worldToScreen(x + w, areaY + PITCH.penaltyAreaWidth);
  ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
}

function drawGoalArea(
  ctx: CanvasRenderingContext2D,
  transform: PitchTransform,
  isLeft: boolean,
  gc: string,
) {
  setLineStyle(ctx, transform, gc);
  const areaY = (PITCH.width - PITCH.goalAreaWidth) / 2;

  let x: number, w: number;
  if (isLeft) {
    x = 0;
    w = PITCH.goalAreaLength;
  } else {
    x = PITCH.length - PITCH.goalAreaLength;
    w = PITCH.goalAreaLength;
  }

  const tl = transform.worldToScreen(x, areaY);
  const br = transform.worldToScreen(x + w, areaY + PITCH.goalAreaWidth);
  ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
}

function drawPenaltySpot(
  ctx: CanvasRenderingContext2D,
  transform: PitchTransform,
  isLeft: boolean,
  gc: string,
) {
  const spotX = isLeft ? PITCH.penaltySpotDistance : PITCH.length - PITCH.penaltySpotDistance;
  const spotY = PITCH.width / 2;
  const pos = transform.worldToScreen(spotX, spotY);

  ctx.fillStyle = pitchLineColor(gc);
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, PITCH.centerSpotRadius * transform.scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawPenaltyArc(
  ctx: CanvasRenderingContext2D,
  transform: PitchTransform,
  isLeft: boolean,
  gc: string,
) {
  setLineStyle(ctx, transform, gc);
  const spotX = isLeft ? PITCH.penaltySpotDistance : PITCH.length - PITCH.penaltySpotDistance;
  const spotY = PITCH.width / 2;
  const center = transform.worldToScreen(spotX, spotY);
  const radius = PITCH.penaltyArcRadius * transform.scale;

  // Clip to outside penalty area — rotation-aware.
  // Transform two points on the penalty area edge line, then clip to the
  // side of that line away from the goal.
  ctx.save();
  ctx.beginPath();

  const penaltyEdgeX = isLeft ? PITCH.penaltyAreaLength : PITCH.length - PITCH.penaltyAreaLength;
  const edgeA = transform.worldToScreen(penaltyEdgeX, 0);
  const edgeB = transform.worldToScreen(penaltyEdgeX, PITCH.width);

  // The midfield point (away from goal) tells us which side of the edge line to keep
  const midfield = transform.worldToScreen(PITCH.length / 2, PITCH.width / 2);

  const canvasW = ctx.canvas.width / (window.devicePixelRatio || 1);
  const canvasH = ctx.canvas.height / (window.devicePixelRatio || 1);

  // Determine if the edge is more horizontal or vertical in screen space
  const dx = Math.abs(edgeB.x - edgeA.x);
  const dy = Math.abs(edgeB.y - edgeA.y);

  if (dy > dx) {
    // Edge is mostly vertical in screen space — clip left or right
    const edgeScreenX = (edgeA.x + edgeB.x) / 2;
    if (midfield.x > edgeScreenX) {
      ctx.rect(edgeScreenX, 0, canvasW - edgeScreenX, canvasH);
    } else {
      ctx.rect(0, 0, edgeScreenX, canvasH);
    }
  } else {
    // Edge is mostly horizontal in screen space — clip above or below
    const edgeScreenY = (edgeA.y + edgeB.y) / 2;
    if (midfield.y > edgeScreenY) {
      ctx.rect(0, edgeScreenY, canvasW, canvasH - edgeScreenY);
    } else {
      ctx.rect(0, 0, canvasW, edgeScreenY);
    }
  }
  ctx.clip();

  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawCornerArcs(ctx: CanvasRenderingContext2D, transform: PitchTransform, gc: string) {
  setLineStyle(ctx, transform, gc);
  const radius = PITCH.cornerArcRadius * transform.scale;
  const rot = transform.rotation; // radians: 0, π/2, π, 3π/2

  // Base angles for rotation=0 (world(0,0)=screen TL)
  // Each corner's arc sweeps a 90° quarter-circle pointing inward.
  // Rotation offsets all screen-space angles by -rotation.
  const corners = [
    { x: 0, y: 0, startAngle: 0 - rot, endAngle: Math.PI / 2 - rot },
    { x: 0, y: PITCH.width, startAngle: Math.PI / 2 - rot, endAngle: Math.PI - rot },
    { x: PITCH.length, y: 0, startAngle: -Math.PI / 2 - rot, endAngle: 0 - rot },
    { x: PITCH.length, y: PITCH.width, startAngle: Math.PI - rot, endAngle: Math.PI * 1.5 - rot },
  ];

  for (const corner of corners) {
    const pos = transform.worldToScreen(corner.x, corner.y);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, corner.startAngle, corner.endAngle);
    ctx.stroke();
  }
}

function drawGoal(
  ctx: CanvasRenderingContext2D,
  transform: PitchTransform,
  isLeft: boolean,
  gc: string,
) {
  const goalY = (PITCH.width - PITCH.goalWidth) / 2;
  const depth = PITCH.goalDepth;
  const postRadius = 0.3; // world units — circular post radius

  // Goal rectangle corners
  const goalLineX = isLeft ? 0 : PITCH.length;
  const backX = isLeft ? -depth : PITCH.length + depth;

  const tl = transform.worldToScreen(
    Math.min(goalLineX, backX),
    goalY,
  );
  const br = transform.worldToScreen(
    Math.max(goalLineX, backX),
    goalY + PITCH.goalWidth,
  );
  const gx = Math.min(tl.x, br.x);
  const gy = Math.min(tl.y, br.y);
  const gw = Math.abs(br.x - tl.x);
  const gh = Math.abs(br.y - tl.y);

  const light = isLightPitch(gc);

  // Net background — subtle semi-transparent fill
  ctx.fillStyle = light ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.07)';
  ctx.fillRect(gx, gy, gw, gh);

  // Net hatching — diamond mesh pattern
  ctx.save();
  ctx.beginPath();
  ctx.rect(gx, gy, gw, gh);
  ctx.clip();

  const netSpacing = Math.max(4, 1.5 * transform.scale);
  ctx.strokeStyle = light ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = Math.max(0.5, 0.06 * transform.scale);

  // Diagonal lines (top-left to bottom-right)
  for (let d = -gh; d < gw + gh; d += netSpacing) {
    ctx.beginPath();
    ctx.moveTo(gx + d, gy);
    ctx.lineTo(gx + d - gh, gy + gh);
    ctx.stroke();
  }
  // Opposite diagonal (top-right to bottom-left)
  for (let d = -gh; d < gw + gh; d += netSpacing) {
    ctx.beginPath();
    ctx.moveTo(gx + d, gy);
    ctx.lineTo(gx + d + gh, gy + gh);
    ctx.stroke();
  }
  ctx.restore();

  // Side net lines — connect posts to back bar along both sides
  const sideLineWidth = Math.max(1.5, 0.15 * transform.scale);
  ctx.strokeStyle = light ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = sideLineWidth;

  // Top side net
  const postTopScreen = transform.worldToScreen(goalLineX, goalY);
  const backTopScreen = transform.worldToScreen(backX, goalY);
  ctx.beginPath();
  ctx.moveTo(postTopScreen.x, postTopScreen.y);
  ctx.lineTo(backTopScreen.x, backTopScreen.y);
  ctx.stroke();

  // Bottom side net
  const postBotScreen = transform.worldToScreen(goalLineX, goalY + PITCH.goalWidth);
  const backBotScreen = transform.worldToScreen(backX, goalY + PITCH.goalWidth);
  ctx.beginPath();
  ctx.moveTo(postBotScreen.x, postBotScreen.y);
  ctx.lineTo(backBotScreen.x, backBotScreen.y);
  ctx.stroke();

  // Back bar — the crossbar at the back of the net
  ctx.strokeStyle = light ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = Math.max(2, 0.25 * transform.scale);
  ctx.beginPath();
  ctx.moveTo(backTopScreen.x, backTopScreen.y);
  ctx.lineTo(backBotScreen.x, backBotScreen.y);
  ctx.stroke();

  // Goal posts — circles on the goal line
  const pr = Math.max(2.5, postRadius * transform.scale);
  ctx.fillStyle = light ? 'rgba(60, 60, 60, 0.95)' : 'rgba(255, 255, 255, 0.95)';
  ctx.strokeStyle = light ? 'rgba(100, 100, 100, 0.6)' : 'rgba(200, 200, 200, 0.6)';
  ctx.lineWidth = Math.max(0.5, 0.05 * transform.scale);

  // Top post
  ctx.beginPath();
  ctx.arc(postTopScreen.x, postTopScreen.y, pr, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Bottom post
  ctx.beginPath();
  ctx.arc(postBotScreen.x, postBotScreen.y, pr, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawGoals(ctx: CanvasRenderingContext2D, transform: PitchTransform, gc: string) {
  drawGoal(ctx, transform, true, gc);
  drawGoal(ctx, transform, false, gc);
}

export function renderPitch(
  ctx: CanvasRenderingContext2D,
  transform: PitchTransform,
  width: number,
  height: number,
  pitchSettings: PitchSettings,
) {
  const gc = pitchSettings.grassColor;
  drawBackground(ctx, width, height);
  drawGrass(ctx, transform, pitchSettings);
  drawOuterLines(ctx, transform, gc);
  drawHalfwayLine(ctx, transform, gc);
  drawCenterCircle(ctx, transform, gc);
  drawPenaltyArea(ctx, transform, true, gc);
  drawPenaltyArea(ctx, transform, false, gc);
  drawGoalArea(ctx, transform, true, gc);
  drawGoalArea(ctx, transform, false, gc);
  drawPenaltySpot(ctx, transform, true, gc);
  drawPenaltySpot(ctx, transform, false, gc);
  drawPenaltyArc(ctx, transform, true, gc);
  drawPenaltyArc(ctx, transform, false, gc);
  drawCornerArcs(ctx, transform, gc);
  drawGoals(ctx, transform, gc);
}

/**
 * Render a transient net ripple/bulge effect at the goal impact point.
 * Called from the render pipeline during an active goal celebration.
 *
 * The effect displaces net mesh lines radially outward from the impact point,
 * using a sine-based decay that creates a "bulge" impression.
 */
export function renderGoalNetRipple(
  ctx: CanvasRenderingContext2D,
  transform: PitchTransform,
  celebration: { startTime: number; impactPoint: { x: number; y: number }; side: 'left' | 'right'; durationMs: number },
  grassColor: string,
): void {
  const elapsed = performance.now() - celebration.startTime;
  const t = Math.min(1, elapsed / celebration.durationMs);
  if (t >= 1) return;

  const goalY = (PITCH.width - PITCH.goalWidth) / 2;
  const depth = PITCH.goalDepth;
  const isLeft = celebration.side === 'left';

  const goalLineX = isLeft ? 0 : PITCH.length;
  const backX = isLeft ? -depth : PITCH.length + depth;

  // Screen-space goal rect
  const tl = transform.worldToScreen(Math.min(goalLineX, backX), goalY);
  const br = transform.worldToScreen(Math.max(goalLineX, backX), goalY + PITCH.goalWidth);
  const gx = Math.min(tl.x, br.x);
  const gy = Math.min(tl.y, br.y);
  const gw = Math.abs(br.x - tl.x);
  const gh = Math.abs(br.y - tl.y);

  // Impact point in screen space
  const impact = transform.worldToScreen(celebration.impactPoint.x, celebration.impactPoint.y);

  // Animation envelope: bulge amplitude rises then decays
  const amplitude = Math.sin(Math.PI * t) * (1 - t);
  const maxDisplacement = 1.5 * transform.scale;

  const light = isLightPitch(grassColor);

  ctx.save();
  ctx.beginPath();
  ctx.rect(gx, gy, gw, gh);
  ctx.clip();

  const netSpacing = Math.max(4, 1.5 * transform.scale);
  ctx.strokeStyle = light ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = Math.max(0.5, 0.06 * transform.scale);

  const displacePoint = (px: number, py: number): [number, number] => {
    const dx = px - impact.x;
    const dy = py - impact.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const radius = Math.max(gw, gh) * 0.8;
    if (dist > radius) return [px, py];

    // Displacement falls off with distance from impact
    const falloff = Math.cos((dist / radius) * (Math.PI / 2));
    const disp = amplitude * maxDisplacement * falloff;

    // Push away from the goal line (into the net)
    const pushX = isLeft ? -disp : disp;
    return [px + pushX, py];
  };

  // Redraw diagonal hatching with displacement
  const steps = Math.ceil((gw + gh) / netSpacing) + 2;
  for (let i = -steps; i <= steps; i++) {
    const d = i * netSpacing;
    // Top-left to bottom-right diagonal
    const [sx1, sy1] = displacePoint(gx + d, gy);
    const [ex1, ey1] = displacePoint(gx + d - gh, gy + gh);
    ctx.beginPath();
    ctx.moveTo(sx1, sy1);
    ctx.lineTo(ex1, ey1);
    ctx.stroke();

    // Top-right to bottom-left diagonal
    const [sx2, sy2] = displacePoint(gx + d, gy);
    const [ex2, ey2] = displacePoint(gx + d + gh, gy + gh);
    ctx.beginPath();
    ctx.moveTo(sx2, sy2);
    ctx.lineTo(ex2, ey2);
    ctx.stroke();
  }

  ctx.restore();
}
