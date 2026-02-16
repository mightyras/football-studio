import { useMemo } from 'react';
import { PITCH, BENCH } from '../constants/pitch';
import type { PitchTransform, ZoneOverlay, ZoomState, PitchRotation } from '../types';

const ROTATION_RADIANS: Record<PitchRotation, number> = {
  0: 0,
  1: Math.PI / 2,
  2: Math.PI,
  3: (3 * Math.PI) / 2,
};

export function computeTransform(
  canvasWidth: number,
  canvasHeight: number,
  benchesEnabled = false,
  zoneOverlay: ZoneOverlay = 'none',
  zoomState?: ZoomState,
  rotation: PitchRotation = 0,
): PitchTransform {
  const sideExtra = benchesEnabled ? (BENCH.gap + BENCH.width) : 0;
  const zoneRightExtra = zoneOverlay !== 'none' ? 8 : 0;

  // At 0° and 180° (vertical): screen-X ↔ pitch width, screen-Y ↔ pitch length
  // At 90° and 270° (landscape): screen-X ↔ pitch length, screen-Y ↔ pitch width
  const isLandscape = rotation === 1 || rotation === 3;

  // Extra vertical padding in landscape so the pitch doesn't fill the entire
  // canvas height (which makes it feel "too zoomed in" compared to portrait).
  const landscapeExtraPad = isLandscape ? 4 : 0;

  const screenWorldWidth = isLandscape
    ? PITCH.length + PITCH.padding * 2 + zoneRightExtra
    : PITCH.width + PITCH.padding * 2 + sideExtra + zoneRightExtra;

  const screenWorldHeight = isLandscape
    ? PITCH.width + PITCH.padding * 2 + sideExtra + landscapeExtraPad * 2
    : PITCH.length + PITCH.padding * 2;

  const scaleX = canvasWidth / screenWorldWidth;
  const scaleY = canvasHeight / screenWorldHeight;
  const baseScale = Math.min(scaleX, scaleY);

  const zoom = zoomState?.zoom ?? 1;
  const scale = baseScale * zoom;
  const rotationRad = ROTATION_RADIANS[rotation];

  // World-to-screen mapping for each rotation:
  //  rot=0: sx = wy·s + ox,         sy = wx·s + oy          (default vertical)
  //  rot=1: sx = wx·s + ox,         sy = (W - wy)·s + oy    (90° CW landscape)
  //  rot=2: sx = (W - wy)·s + ox,   sy = (L - wx)·s + oy    (180° flipped vertical)
  //  rot=3: sx = (L - wx)·s + ox,   sy = wy·s + oy          (270° CW landscape)
  const L = PITCH.length;
  const W = PITCH.width;

  let offsetX: number;
  let offsetY: number;

  if (zoom > 1) {
    const focusX = zoomState?.focusX ?? L / 2;
    const focusY = zoomState?.focusY ?? W / 2;
    // Compute where the focus point maps in raw screen coords (without offset)
    let rawFocusSX: number, rawFocusSY: number;
    switch (rotation) {
      case 0: rawFocusSX = focusY * scale; rawFocusSY = focusX * scale; break;
      case 1: rawFocusSX = focusX * scale; rawFocusSY = (W - focusY) * scale; break;
      case 2: rawFocusSX = (W - focusY) * scale; rawFocusSY = (L - focusX) * scale; break;
      case 3: rawFocusSX = (L - focusX) * scale; rawFocusSY = focusY * scale; break;
    }
    offsetX = canvasWidth / 2 - rawFocusSX;
    offsetY = canvasHeight / 2 - rawFocusSY;
  } else {
    // Center the pitch in the canvas with appropriate padding
    const padX = isLandscape ? PITCH.padding : (PITCH.padding + sideExtra);
    const padY = isLandscape ? (PITCH.padding + sideExtra) : PITCH.padding;
    offsetX = (canvasWidth - screenWorldWidth * scale) / 2 + padX * scale;
    offsetY = (canvasHeight - screenWorldHeight * scale) / 2 + padY * scale;
  }

  // Build worldToScreen / screenToWorld based on rotation
  let worldToScreen: (wx: number, wy: number) => { x: number; y: number };
  let screenToWorld: (sx: number, sy: number) => { x: number; y: number };

  switch (rotation) {
    case 0:
      worldToScreen = (wx, wy) => ({ x: wy * scale + offsetX, y: wx * scale + offsetY });
      screenToWorld = (sx, sy) => ({ x: (sy - offsetY) / scale, y: (sx - offsetX) / scale });
      break;
    case 1:
      worldToScreen = (wx, wy) => ({ x: wx * scale + offsetX, y: (W - wy) * scale + offsetY });
      screenToWorld = (sx, sy) => ({ x: (sx - offsetX) / scale, y: W - (sy - offsetY) / scale });
      break;
    case 2:
      worldToScreen = (wx, wy) => ({ x: (W - wy) * scale + offsetX, y: (L - wx) * scale + offsetY });
      screenToWorld = (sx, sy) => ({ x: L - (sy - offsetY) / scale, y: W - (sx - offsetX) / scale });
      break;
    case 3:
      worldToScreen = (wx, wy) => ({ x: (L - wx) * scale + offsetX, y: wy * scale + offsetY });
      screenToWorld = (sx, sy) => ({ x: L - (sx - offsetX) / scale, y: (sy - offsetY) / scale });
      break;
  }

  return {
    scale,
    offsetX,
    offsetY,
    zoom,
    rotation: rotationRad,
    worldToScreen,
    screenToWorld,
  };
}

export function usePitchTransform(
  canvasWidth: number,
  canvasHeight: number,
  benchesEnabled = false,
  zoneOverlay: ZoneOverlay = 'none',
  zoomState?: ZoomState,
  rotation: PitchRotation = 0,
): PitchTransform {
  return useMemo(
    () => computeTransform(canvasWidth, canvasHeight, benchesEnabled, zoneOverlay, zoomState, rotation),
    [canvasWidth, canvasHeight, benchesEnabled, zoneOverlay,
     zoomState?.zoom, zoomState?.focusX, zoomState?.focusY, rotation],
  );
}
