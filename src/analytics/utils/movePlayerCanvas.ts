/**
 * Pure canvas utilities for the "Move Player" feature.
 * No React — all functions take canvas/video elements and return canvases.
 */

/** Capture the current video frame to an off-screen canvas at native resolution. */
export function captureVideoFrame(video: HTMLVideoElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Extract an ellipse-shaped cutout from a frame canvas with feathered (soft) edges.
 *
 * @param frame       Source frame canvas (native video resolution)
 * @param centerNorm  Ellipse center in normalized 0-1 coords
 * @param rxNorm      Horizontal radius in normalized coords
 * @param ryNorm      Vertical radius in normalized coords
 * @param featherPx   Feather width in pixels (default 8)
 * @returns           Canvas containing just the cutout (sized to bounding box + feather padding)
 */
export function extractEllipseCutout(
  frame: HTMLCanvasElement,
  centerNorm: { x: number; y: number },
  rxNorm: number,
  ryNorm: number,
  featherPx = 8,
): HTMLCanvasElement {
  const fw = frame.width;
  const fh = frame.height;

  // Convert normalized coords to pixel coords
  const cx = centerNorm.x * fw;
  const cy = centerNorm.y * fh;
  const rx = rxNorm * fw;
  const ry = ryNorm * fh;

  // Bounding box with feather padding
  const pad = featherPx;
  const bx = Math.max(0, Math.floor(cx - rx - pad));
  const by = Math.max(0, Math.floor(cy - ry - pad));
  const bw = Math.min(fw, Math.ceil(cx + rx + pad)) - bx;
  const bh = Math.min(fh, Math.ceil(cy + ry + pad)) - by;

  // Extract source pixels
  const frameCtx = frame.getContext('2d')!;
  const srcData = frameCtx.getImageData(bx, by, bw, bh);
  const pixels = srcData.data;

  // Apply ellipse alpha mask with feathered edges
  const localCx = cx - bx;
  const localCy = cy - by;
  const safeRx = Math.max(rx, 1);
  const safeRy = Math.max(ry, 1);
  const featherNorm = featherPx / Math.min(safeRx, safeRy);
  const innerEdge = Math.max(0, 1.0 - featherNorm);

  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const dx = x - localCx;
      const dy = y - localCy;
      const d = Math.sqrt((dx * dx) / (safeRx * safeRx) + (dy * dy) / (safeRy * safeRy));

      let alpha: number;
      if (d <= innerEdge) {
        alpha = 1.0;
      } else if (d >= 1.0) {
        alpha = 0.0;
      } else {
        const t = (d - innerEdge) / (1.0 - innerEdge);
        alpha = 0.5 * (1.0 + Math.cos(t * Math.PI));
      }

      const idx = (y * bw + x) * 4;
      pixels[idx + 3] = Math.round(alpha * pixels[idx + 3]);
    }
  }

  // Write to cutout canvas
  const cutout = document.createElement('canvas');
  cutout.width = bw;
  cutout.height = bh;
  const cutCtx = cutout.getContext('2d')!;
  cutCtx.putImageData(srcData, 0, 0);

  return cutout;
}

/**
 * Fill the ellipse hole in the frame with surrounding grass.
 *
 * Strategy: shift copies of the surrounding area from multiple directions
 * into the hole, then blur heavily. This avoids the banding artifacts
 * of strip-tiling and produces a smooth, natural-looking grass fill.
 *
 * @returns A new canvas with the hole inpainted
 */
export function inpaintEllipseHole(
  frame: HTMLCanvasElement,
  centerNorm: { x: number; y: number },
  rxNorm: number,
  ryNorm: number,
  featherPx = 8,
): HTMLCanvasElement {
  const fw = frame.width;
  const fh = frame.height;
  const cx = centerNorm.x * fw;
  const cy = centerNorm.y * fh;
  const rx = rxNorm * fw;
  const ry = ryNorm * fh;

  // Clone the frame
  const bg = document.createElement('canvas');
  bg.width = fw;
  bg.height = fh;
  const bgCtx = bg.getContext('2d')!;
  bgCtx.drawImage(frame, 0, 0);

  // Fill the hole by shifting the frame from 4 directions and blending
  const clipRx = rx + featherPx;
  const clipRy = ry + featherPx;

  bgCtx.save();
  bgCtx.beginPath();
  bgCtx.ellipse(cx, cy, clipRx, clipRy, 0, 0, Math.PI * 2);
  bgCtx.clip();

  // Shift the frame from each direction — each fills part of the hole
  // with grass from outside the ellipse
  const shiftDx = rx * 1.2;
  const shiftDy = ry * 1.2;
  bgCtx.globalAlpha = 0.5;
  bgCtx.drawImage(frame, shiftDx, 0);   // from left
  bgCtx.drawImage(frame, -shiftDx, 0);  // from right
  bgCtx.globalAlpha = 0.5;
  bgCtx.drawImage(frame, 0, shiftDy);   // from above
  bgCtx.drawImage(frame, 0, -shiftDy);  // from below

  bgCtx.restore();

  // Blur pass to smooth everything
  if ('filter' in bgCtx) {
    const blurCanvas = document.createElement('canvas');
    blurCanvas.width = fw;
    blurCanvas.height = fh;
    const blurCtx = blurCanvas.getContext('2d')!;
    blurCtx.filter = `blur(${Math.max(8, Math.round(Math.min(rx, ry) * 0.4))}px)`;
    blurCtx.drawImage(bg, 0, 0);

    bgCtx.save();
    bgCtx.beginPath();
    bgCtx.ellipse(cx, cy, clipRx, clipRy, 0, 0, Math.PI * 2);
    bgCtx.clip();
    bgCtx.drawImage(blurCanvas, 0, 0);
    bgCtx.restore();
  }

  return bg;
}

/**
 * Compute the pixel-space bounding box origin of the cutout
 * (matches the extractEllipseCutout logic).
 */
export function getCutoutOrigin(
  frameWidth: number,
  frameHeight: number,
  centerNorm: { x: number; y: number },
  rxNorm: number,
  ryNorm: number,
  featherPx = 8,
): { x: number; y: number } {
  const cx = centerNorm.x * frameWidth;
  const cy = centerNorm.y * frameHeight;
  const rx = rxNorm * frameWidth;
  const ry = ryNorm * frameHeight;
  const pad = featherPx;
  return {
    x: Math.max(0, Math.floor(cx - rx - pad)),
    y: Math.max(0, Math.floor(cy - ry - pad)),
  };
}
