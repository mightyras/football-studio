import type { AppState } from '../types';
import { render } from '../canvas/renderPipeline';
import { computeTransform } from '../hooks/usePitchTransform';
import { PITCH, BENCH } from '../constants/pitch';

/**
 * Compute canvas dimensions that tightly fit the pitch area (including padding,
 * benches, and zone overlays) at a given target height in pixels.
 * The result matches the aspect ratio of the pitch world so there are no dark margins.
 */
function computePitchDimensions(
  state: AppState,
  targetHeight: number,
): { width: number; height: number } {
  const benchesEnabled = state.pitchSettings.stadiumEnabled;
  const zoneOverlay = state.pitchSettings.zoneOverlay;
  const sideExtra = benchesEnabled ? (BENCH.gap + BENCH.width) : 0;
  const zoneRightExtra = zoneOverlay !== 'none' ? 8 : 0;

  // Portrait (rotation 0) — same logic as computeTransform
  const screenWorldWidth = PITCH.width + PITCH.padding * 2 + sideExtra + zoneRightExtra;
  const screenWorldHeight = PITCH.length + PITCH.padding * 2;

  const aspect = screenWorldWidth / screenWorldHeight;
  const width = Math.round(targetHeight * aspect);

  return { width, height: targetHeight };
}

/**
 * Render the current scene to an offscreen canvas.
 * Clears transient UI state (selections, hover, drawing) so the export is clean.
 *
 * Uses the same DPR scaling convention as the live canvas so that renderers
 * that reference `ctx.canvas.width / devicePixelRatio` (e.g. penalty-arc
 * clip rects) produce correct results.
 */
export function renderSceneToCanvas(
  state: AppState,
  width: number,
  height: number,
): HTMLCanvasElement {
  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  // Clean transient state for a clean render
  const cleanState: AppState = {
    ...state,
    selectedPlayerId: null,
    hoveredPlayerId: null,
    editingPlayerId: null,
    ballSelected: false,
    ballHovered: false,
    drawingInProgress: null,
    selectedAnnotationId: null,
    editingAnnotationId: null,
    cmdHeld: false,
    shiftHeld: false,
    annotationPlayback: false,
  };

  const transform = computeTransform(
    width,
    height,
    state.pitchSettings.stadiumEnabled,
    state.pitchSettings.zoneOverlay,
  );

  render(ctx, transform, cleanState, width, height);
  return canvas;
}

/**
 * Render the scene to a PNG Blob, tightly cropped to the pitch area.
 * Canvas dimensions are auto-computed from the pitch world dimensions.
 */
export function renderSceneToBlob(
  state: AppState,
  targetHeight = 1080,
): Promise<Blob> {
  const { width, height } = computePitchDimensions(state, targetHeight);
  const canvas = renderSceneToCanvas(state, width, height);
  return new Promise(resolve =>
    canvas.toBlob(blob => resolve(blob!), 'image/png'),
  );
}

/**
 * Generate a small thumbnail data URL for a saved scene card.
 * Uses pitch-fitting dimensions at thumbnail scale.
 * Strips visual clutter (names, annotations, overlays) for legibility.
 */
export function generateThumbnail(state: AppState): string {
  const thumbState: AppState = {
    ...state,
    // Hide text / labels that become illegible noise at small sizes
    showPlayerNamesA: false,
    showPlayerNamesB: false,
    // Hide overlays that clutter the thumbnail
    showOrientation: false,
    showCoverShadow: false,
    fovMode: 'off' as const,
    // Remove annotations — they become messy scribbles at thumbnail scale
    annotations: [],
    ghostAnnotationIds: [],
    ghostPlayers: [],
  };
  const { width, height } = computePitchDimensions(thumbState, 100);
  return renderSceneToCanvas(thumbState, width, height).toDataURL('image/png', 0.7);
}
