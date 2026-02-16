import { PITCH } from '../constants/pitch';
import { THEME } from '../constants/colors';
import type { PitchTransform, PitchSettings } from '../types';

// ── Label color (not user-customizable) ──

const LABEL_COLOR = 'rgba(255, 255, 255, 0.55)';

// ── Boundary helpers (derived from PITCH constants, no magic numbers) ──

const penaltyEdgeY = (PITCH.width - PITCH.penaltyAreaWidth) / 2;   // 13.84
const goalEdgeY = (PITCH.width - PITCH.goalAreaWidth) / 2;         // 24.84

// ── Style type threaded through draw functions ──

type ZoneStyle = {
  lineColor: string;
  lineWidth: number;
  tintA: string;
  tintB: string;
  goldenTint: string;
};

// ── Helpers ──

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function fillZoneRect(
  ctx: CanvasRenderingContext2D,
  transform: PitchTransform,
  wx0: number, wy0: number,
  wx1: number, wy1: number,
  fill: string,
) {
  const tl = transform.worldToScreen(wx0, wy0);
  const br = transform.worldToScreen(wx1, wy1);
  ctx.fillStyle = fill;
  ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  transform: PitchTransform,
  wx0: number, wy0: number,
  wx1: number, wy1: number,
) {
  const from = transform.worldToScreen(wx0, wy0);
  const to = transform.worldToScreen(wx1, wy1);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

/** Label placed inside a zone cell (e.g. 18-zone cell numbers) */
function drawCellLabel(
  ctx: CanvasRenderingContext2D,
  transform: PitchTransform,
  cwx: number, cwy: number,
  text: string,
) {
  const pos = transform.worldToScreen(cwx, cwy);
  const fontSize = Math.max(10, 1.2 * transform.scale);
  ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 3;
  ctx.fillStyle = LABEL_COLOR;
  ctx.fillText(text.toUpperCase(), pos.x, pos.y);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}

/** Label placed in the margin outside the pitch (horizontal text) */
function drawMarginLabel(
  ctx: CanvasRenderingContext2D,
  transform: PitchTransform,
  cwx: number, cwy: number,
  text: string,
) {
  const pos = transform.worldToScreen(cwx, cwy);
  const fontSize = Math.max(10, 1.4 * transform.scale);
  ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 3;
  ctx.fillStyle = LABEL_COLOR;
  ctx.fillText(text.toUpperCase(), pos.x, pos.y);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}

/** Label placed in the right margin, rotated 90° (reads bottom-to-top) */
function drawRotatedMarginLabel(
  ctx: CanvasRenderingContext2D,
  transform: PitchTransform,
  cwx: number, cwy: number,
  text: string,
) {
  const pos = transform.worldToScreen(cwx, cwy);
  const fontSize = Math.max(10, 1.4 * transform.scale);
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(-Math.PI / 2);
  ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 3;
  ctx.fillStyle = LABEL_COLOR;
  ctx.fillText(text.toUpperCase(), 0, 0);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.restore();
}

// ── Public entry point ──

export function renderZoneOverlay(
  ctx: CanvasRenderingContext2D,
  transform: PitchTransform,
  settings: PitchSettings,
  accent: string = THEME.accent,
): void {
  if (settings.zoneOverlay === 'none') return;

  // Compute style from user settings
  const style: ZoneStyle = {
    lineColor: hexToRgba(settings.zoneLineColor, settings.zoneLineOpacity),
    lineWidth: settings.zoneLineWidth,
    tintA: `rgba(255, 255, 255, ${0.07 * settings.zoneTintOpacity})`,
    tintB: `rgba(0, 0, 0, ${0.10 * settings.zoneTintOpacity})`,
    goldenTint: hexToRgba(accent, 0.12 * settings.zoneTintOpacity),
  };

  ctx.save();
  ctx.setLineDash([]);

  switch (settings.zoneOverlay) {
    case 'corridors':
      drawCorridors(ctx, transform, style);
      break;
    case 'zones18':
      drawZones18(ctx, transform, settings.zoneDirection, style);
      break;
    case 'thirds':
      drawThirds(ctx, transform, settings.zoneDirection, style);
      break;
    case 'phases':
      drawPhases(ctx, transform, settings.zoneDirection, style);
      break;
  }

  ctx.restore();
}

// ── Five Corridors ──

function drawCorridors(ctx: CanvasRenderingContext2D, transform: PitchTransform, style: ZoneStyle) {
  const boundaries = [
    0,
    penaltyEdgeY,                        // 13.84
    goalEdgeY,                           // 24.84
    PITCH.width - goalEdgeY,             // 43.16
    PITCH.width - penaltyEdgeY,          // 54.16
    PITCH.width,                         // 68
  ];
  const labels = ['Wing', 'Half-space', 'Centre', 'Half-space', 'Wing'];

  // Fills
  for (let i = 0; i < 5; i++) {
    const tint = i % 2 === 0 ? style.tintA : style.tintB;
    fillZoneRect(ctx, transform, 0, boundaries[i], PITCH.length, boundaries[i + 1], tint);
  }

  // Boundary lines (4 internal)
  ctx.strokeStyle = style.lineColor;
  ctx.lineWidth = style.lineWidth;
  for (let i = 1; i < 5; i++) {
    drawLine(ctx, transform, 0, boundaries[i], PITCH.length, boundaries[i]);
  }

  // Labels — placed above the pitch in the top margin (horizontal text)
  for (let i = 0; i < 5; i++) {
    const midY = (boundaries[i] + boundaries[i + 1]) / 2;
    drawMarginLabel(ctx, transform, -PITCH.padding / 2, midY, labels[i]);
  }
}

// ── 18-Zone Grid ──

function drawZones18(
  ctx: CanvasRenderingContext2D,
  transform: PitchTransform,
  direction: PitchSettings['zoneDirection'],
  style: ZoneStyle,
) {
  const rowDepth = PITCH.length / 6; // 17.5
  const rows = Array.from({ length: 7 }, (_, i) => i * rowDepth);
  const cols = [0, goalEdgeY, PITCH.width - goalEdgeY, PITCH.width];

  // When bottom-to-top, numbering starts from the bottom:
  // row 0 (screen top) gets the highest numbers, row 5 (screen bottom) gets 1–3
  const getZoneNum = (r: number, c: number): number => {
    if (direction === 'bottom-to-top') {
      const flippedRow = 5 - r;
      return flippedRow * 3 + c + 1;
    }
    return r * 3 + c + 1;
  };

  // Fills & cell labels
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 3; c++) {
      const zoneNum = getZoneNum(r, c);
      const isGolden = zoneNum === 14;
      const tint = isGolden
        ? style.goldenTint
        : (r + c) % 2 === 0 ? style.tintA : style.tintB;
      fillZoneRect(ctx, transform, rows[r], cols[c], rows[r + 1], cols[c + 1], tint);

      const midX = (rows[r] + rows[r + 1]) / 2;
      const midY = (cols[c] + cols[c + 1]) / 2;
      drawCellLabel(ctx, transform, midX, midY, zoneNum.toString());
    }
  }

  // Horizontal boundary lines (5 internal)
  ctx.strokeStyle = style.lineColor;
  ctx.lineWidth = style.lineWidth;
  for (let r = 1; r < 6; r++) {
    drawLine(ctx, transform, rows[r], 0, rows[r], PITCH.width);
  }

  // Vertical boundary lines (2 internal)
  for (let c = 1; c < 3; c++) {
    drawLine(ctx, transform, 0, cols[c], PITCH.length, cols[c]);
  }

  // Column labels (corridor names) in top margin (horizontal text)
  const colLabels = ['Wide', 'Central', 'Wide'];
  for (let c = 0; c < 3; c++) {
    const midY = (cols[c] + cols[c + 1]) / 2;
    drawMarginLabel(ctx, transform, -PITCH.padding / 2, midY, colLabels[c]);
  }
}

// ── Horizontal Thirds ──

function drawThirds(
  ctx: CanvasRenderingContext2D,
  transform: PitchTransform,
  direction: PitchSettings['zoneDirection'],
  style: ZoneStyle,
) {
  const thirdDepth = PITCH.length / 3; // 35
  const boundaries = [0, thirdDepth, thirdDepth * 2, PITCH.length];

  const labels = direction === 'bottom-to-top'
    ? ['Attacking Third', 'Middle Third', 'Defensive Third']
    : ['Defensive Third', 'Middle Third', 'Attacking Third'];

  // Fills
  for (let i = 0; i < 3; i++) {
    const tint = i % 2 === 0 ? style.tintA : style.tintB;
    fillZoneRect(ctx, transform, boundaries[i], 0, boundaries[i + 1], PITCH.width, tint);
  }

  // Boundary lines (2 internal)
  ctx.strokeStyle = style.lineColor;
  ctx.lineWidth = style.lineWidth;
  for (let i = 1; i < 3; i++) {
    drawLine(ctx, transform, boundaries[i], 0, boundaries[i], PITCH.width);
  }

  // Labels — placed to the right of the pitch, rotated 90°
  for (let i = 0; i < 3; i++) {
    const midX = (boundaries[i] + boundaries[i + 1]) / 2;
    drawRotatedMarginLabel(ctx, transform, midX, PITCH.width + PITCH.padding / 2 + 1, labels[i]);
  }
}

// ── Phases of Play ──

function drawPhases(
  ctx: CanvasRenderingContext2D,
  transform: PitchTransform,
  direction: PitchSettings['zoneDirection'],
  style: ZoneStyle,
) {
  const phaseDepth = PITCH.length / 4; // 26.25
  const boundaries = [0, phaseDepth, phaseDepth * 2, phaseDepth * 3, PITCH.length];

  const labels = direction === 'bottom-to-top'
    ? ['Finish', 'Penetrate', 'Progress', 'Build']
    : ['Build', 'Progress', 'Penetrate', 'Finish'];

  // Fills
  for (let i = 0; i < 4; i++) {
    const tint = i % 2 === 0 ? style.tintA : style.tintB;
    fillZoneRect(ctx, transform, boundaries[i], 0, boundaries[i + 1], PITCH.width, tint);
  }

  // Boundary lines (3 internal)
  ctx.strokeStyle = style.lineColor;
  ctx.lineWidth = style.lineWidth;
  for (let i = 1; i < 4; i++) {
    drawLine(ctx, transform, boundaries[i], 0, boundaries[i], PITCH.width);
  }

  // Labels — placed to the right of the pitch, rotated 90°
  for (let i = 0; i < 4; i++) {
    const midX = (boundaries[i] + boundaries[i + 1]) / 2;
    drawRotatedMarginLabel(ctx, transform, midX, PITCH.width + PITCH.padding / 2 + 1, labels[i]);
  }
}
