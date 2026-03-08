import { PITCH, BENCH } from '../constants/pitch';
import type { PitchTransform, SubstitutePlayer } from '../types';

/**
 * Render bench areas on the sidelines with substitute player tokens.
 */
export function renderBenches(
  ctx: CanvasRenderingContext2D,
  transform: PitchTransform,
  substitutesA: SubstitutePlayer[],
  substitutesB: SubstitutePlayer[],
  teamAColor: string,
  teamBColor: string,
  activeBench: 'A' | 'B' | null,
) {
  const pad = PITCH.padding;
  const benchY0 = -pad - BENCH.gap - BENCH.width; // same sideline (low Y)
  const benchY1 = benchY0 + BENCH.width;

  // Team A bench — left of halfway line
  drawBench(
    ctx, transform,
    BENCH.aStartX, BENCH.aEndX,
    benchY0, benchY1,
    teamAColor, 'A', substitutesA, activeBench === 'A',
  );

  // Team B bench — right of halfway line
  drawBench(
    ctx, transform,
    BENCH.bStartX, BENCH.bEndX,
    benchY0, benchY1,
    teamBColor, 'B', substitutesB, activeBench === 'B',
  );
}

function drawBench(
  ctx: CanvasRenderingContext2D,
  transform: PitchTransform,
  worldX0: number,
  worldX1: number,
  worldY0: number,
  worldY1: number,
  teamColor: string,
  _team: 'A' | 'B',
  substitutes: SubstitutePlayer[],
  isActive: boolean,
) {
  const tl = transform.worldToScreen(worldX0, worldY0);
  const br = transform.worldToScreen(worldX1, worldY1);
  const x = Math.min(tl.x, br.x);
  const y = Math.min(tl.y, br.y);
  const w = Math.abs(br.x - tl.x);
  const h = Math.abs(br.y - tl.y);

  // Bench background
  ctx.save();

  // Active glow
  if (isActive) {
    ctx.shadowColor = teamColor;
    ctx.shadowBlur = 12;
  }

  // Background panel
  ctx.fillStyle = 'rgba(20, 20, 30, 0.85)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.fill();

  ctx.shadowColor = 'transparent';

  // Team color accent strip along the bottom edge
  const stripHeight = 3;
  ctx.fillStyle = teamColor;
  ctx.globalAlpha = 0.6;
  ctx.fillRect(x, y + h - stripHeight, w, stripHeight);
  ctx.globalAlpha = 1.0;

  // Border
  ctx.strokeStyle = isActive ? teamColor : 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = isActive ? 2 : 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.stroke();

  // "BENCH" label — when horizontal move it above the bench
  const isVertical = h > w;
  const fontSize = Math.max(8, 1.2 * transform.scale);
  ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.textAlign = 'center';
  if (isVertical) {
    ctx.textBaseline = 'top';
    ctx.fillText('BENCH', x + w / 2, y + 3);
  } else {
    ctx.textBaseline = 'bottom';
    ctx.fillText('BENCH', x + w / 2, y - 3);
  }

  // Substitute tokens — layout adapts to bench orientation
  if (substitutes.length > 0) {
    const tokenRadius = Math.max(6, 1.2 * transform.scale);

    // Distribute tokens along the longer axis
    const mainDim = isVertical ? h : w;
    const spacing = Math.min(
      (mainDim - tokenRadius * 2) / substitutes.length,
      tokenRadius * 3,
    );
    const mainStart = (isVertical ? y + h / 2 : x + w / 2)
      - ((substitutes.length - 1) * spacing) / 2;
    const crossCenter = isVertical
      ? x + w / 2
      : y + h / 2 + fontSize * 0.3;

    for (let i = 0; i < substitutes.length; i++) {
      const sub = substitutes[i];
      const mainPos = mainStart + i * spacing;
      const cx = isVertical ? crossCenter : mainPos;
      const cy = isVertical ? mainPos : crossCenter;

      // Token circle
      ctx.beginPath();
      ctx.arc(cx, cy, tokenRadius, 0, Math.PI * 2);
      ctx.fillStyle = teamColor;
      ctx.globalAlpha = 0.7;
      ctx.fill();
      ctx.globalAlpha = 1.0;

      // Number
      const numFontSize = Math.max(6, tokenRadius * 0.8);
      ctx.font = `bold ${numFontSize}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sub.number.toString(), cx, cy);
    }
  }

  ctx.restore();
}

/**
 * Get the world-space bounding box for a team's bench area.
 * Used for hit testing clicks.
 */
export function getBenchBounds(team: 'A' | 'B'): {
  x0: number; y0: number; x1: number; y1: number;
} {
  const pad = PITCH.padding;
  const benchY = -pad - BENCH.gap - BENCH.width;
  if (team === 'A') {
    return {
      x0: BENCH.aStartX,
      y0: benchY,
      x1: BENCH.aEndX,
      y1: benchY + BENCH.width,
    };
  } else {
    return {
      x0: BENCH.bStartX,
      y0: benchY,
      x1: BENCH.bEndX,
      y1: benchY + BENCH.width,
    };
  }
}
