import { useRef, useEffect, useCallback, useImperativeHandle, forwardRef, useState } from 'react';
import { useAnalytics } from '../AnalyticsContext';
import {
  captureVideoFrame,
  extractEllipseCutout,
  inpaintEllipseHole,
  getCutoutOrigin,
} from '../utils/movePlayerCanvas';

type Props = {
  videoElement: HTMLVideoElement | null;
};

export type MovePlayerOverlayHandle = {
  /** Returns a clean composite canvas (background + placed players) at native video resolution for screenshot capture. */
  buildComposite: () => HTMLCanvasElement | null;
};

const FEATHER_PX = 8;
const HIT_TEST_RADIUS_FACTOR = 1.3;
const MIN_SCALE = 0.3;
const MAX_SCALE = 3;
const SCALE_STEP_UP = 1.05;
const SCALE_STEP_DOWN = 0.95;
const MIN_SELECTION_RADIUS = 0.008;

/** A player that has been cut out and placed. */
type PlacedPlayer = {
  cutout: HTMLCanvasElement;
  cutoutOrigin: { x: number; y: number };
  originalCenter: { x: number; y: number };
  currentCenter: { x: number; y: number };
  radiusX: number;
  radiusY: number;
  scale: number;
};

function MovePlayerOverlayInner({ videoElement }: Props, ref: React.ForwardedRef<MovePlayerOverlayHandle>) {
  const { state, dispatch } = useAnalytics();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  // The accumulated background (original frame with all holes inpainted)
  const backgroundRef = useRef<HTMLCanvasElement | null>(null);
  // All placed players as separate draggable entities
  const placedPlayersRef = useRef<PlacedPlayer[]>([]);

  // Drag state — used when re-dragging an existing placed player
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragIndexRef = useRef(-1);
  const dragPosRef = useRef<{ x: number; y: number } | null>(null);

  // Preview ellipse during select-second-edge
  const previewEdgeRef = useRef<{ x: number; y: number } | null>(null);

  // Hover state — which placed player is the cursor over (state for cursor re-render)
  const [hoverIndex, setHoverIndex] = useState(-1);
  const hoverIndexRef = useRef(-1);
  hoverIndexRef.current = hoverIndex;

  useImperativeHandle(ref, () => ({
    buildComposite: () => buildCompositeFn(),
  }));

  const hasState = state.movePlayerState !== null;
  const isInteractive = state.activeTool === 'move-player' && hasState;
  const phase = state.movePlayerState?.phase;

  // Capture frame when tool is first activated
  useEffect(() => {
    if (hasState && phase === 'select-first-edge' && videoElement && videoElement.readyState >= 2) {
      if (!backgroundRef.current) {
        backgroundRef.current = captureVideoFrame(videoElement);
      }
    }
    if (!hasState) {
      backgroundRef.current = null;
      placedPlayersRef.current = [];
      dragPosRef.current = null;
      previewEdgeRef.current = null;
      dragIndexRef.current = -1;
      setHoverIndex(-1);
    }
  }, [hasState, phase, videoElement]);

  // Canvas sizing
  const updateCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const dpr = window.devicePixelRatio || 1;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    if (h <= 0 || w <= 0) return;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
  }, []);

  useEffect(() => {
    if (!hasState) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    updateCanvasSize();
    const ro = new ResizeObserver(updateCanvasSize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    return () => ro.disconnect();
  }, [hasState, updateCanvasSize]);

  // Build composite = background + all placed players (uses live drag position if active)
  const buildCompositeFn = useCallback((): HTMLCanvasElement | null => {
    const bg = backgroundRef.current;
    if (!bg) return null;
    const result = document.createElement('canvas');
    result.width = bg.width;
    result.height = bg.height;
    const ctx = result.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bg, 0, 0);
    for (let i = 0; i < placedPlayersRef.current.length; i++) {
      const p = placedPlayersRef.current[i];
      // Use live drag position if this player is currently being dragged
      if (isDraggingRef.current && dragIndexRef.current === i && dragPosRef.current) {
        const temp = { ...p, currentCenter: dragPosRef.current };
        drawScaledCutout(ctx, temp, bg.width, bg.height);
      } else {
        drawScaledCutout(ctx, p, bg.width, bg.height);
      }
    }
    return result;
  }, []);

  // Cut a new player and immediately place it
  const performCutAndPlace = useCallback((
    center: { x: number; y: number },
    rxNorm: number,
    ryNorm: number,
  ) => {
    const composite = buildCompositeFn();
    if (!composite) return;

    const cutout = extractEllipseCutout(composite, center, rxNorm, ryNorm, FEATHER_PX);
    const origin = getCutoutOrigin(composite.width, composite.height, center, rxNorm, ryNorm, FEATHER_PX);

    // Inpaint the hole into the background
    backgroundRef.current = inpaintEllipseHole(
      backgroundRef.current!, center, rxNorm, ryNorm, FEATHER_PX,
    );

    // Immediately place the cutout at its original position
    placedPlayersRef.current.push({
      cutout,
      cutoutOrigin: origin,
      originalCenter: { ...center },
      currentCenter: { ...center },
      radiusX: rxNorm,
      radiusY: ryNorm,
      scale: 1,
    });
  }, [buildComposite]);

  // Hit-test placed players (returns index or -1)
  const hitTestPlacedPlayers = useCallback((nx: number, ny: number): number => {
    for (let i = placedPlayersRef.current.length - 1; i >= 0; i--) {
      const p = placedPlayersRef.current[i];
      const dx = nx - p.currentCenter.x;
      const dy = ny - p.currentCenter.y;
      const d = Math.sqrt(
        (dx * dx) / (p.radiusX * p.radiusX) + (dy * dy) / (p.radiusY * p.radiusY),
      );
      if (d <= HIT_TEST_RADIUS_FACTOR) return i;
    }
    return -1;
  }, []);

  // Prevent context menu on the canvas
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (isInteractive) e.preventDefault();
  }, [isInteractive]);

  // Pointer handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isInteractive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Right-click cancels current selection without clearing placed players
    if (e.button === 2) {
      e.preventDefault();
      if (phase === 'select-second-edge') {
        previewEdgeRef.current = null;
        dispatch({
          type: 'SET_MOVE_PLAYER_STATE',
          state: { phase: 'select-first-edge', moveCount: state.movePlayerState?.moveCount ?? 0 },
        });
      }
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;

    if (phase === 'select-first-edge') {
      // Check if clicking on a placed player to re-drag it
      const hitIdx = hitTestPlacedPlayers(nx, ny);
      if (hitIdx >= 0) {
        const p = placedPlayersRef.current[hitIdx];
        isDraggingRef.current = true;
        dragIndexRef.current = hitIdx;
        dragOffsetRef.current = { x: nx - p.currentCenter.x, y: ny - p.currentCenter.y };
        dragPosRef.current = { ...p.currentCenter };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }

      // Start new ellipse selection
      dispatch({
        type: 'UPDATE_MOVE_PLAYER_PHASE',
        phase: 'select-second-edge',
        patch: { firstEdge: { x: nx, y: ny } },
      });
    } else if (phase === 'select-second-edge') {
      const firstEdge = state.movePlayerState?.firstEdge;
      if (!firstEdge) return;

      const center = {
        x: (firstEdge.x + nx) / 2,
        y: (firstEdge.y + ny) / 2,
      };
      const rxNorm = Math.abs(nx - firstEdge.x) / 2;
      const ryNorm = Math.abs(ny - firstEdge.y) / 2;

      if (rxNorm < MIN_SELECTION_RADIUS || ryNorm < MIN_SELECTION_RADIUS) return;

      performCutAndPlace(center, rxNorm, ryNorm);

      // Go back to selection immediately
      dispatch({
        type: 'SET_MOVE_PLAYER_STATE',
        state: {
          phase: 'select-first-edge',
          moveCount: (state.movePlayerState?.moveCount ?? 0) + 1,
        },
      });
    }
  }, [isInteractive, phase, state.movePlayerState, dispatch, performCutAndPlace, hitTestPlacedPlayers]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isInteractive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;

    if (isDraggingRef.current) {
      e.preventDefault();
      dragPosRef.current = {
        x: Math.max(0, Math.min(1, nx - dragOffsetRef.current.x)),
        y: Math.max(0, Math.min(1, ny - dragOffsetRef.current.y)),
      };
    } else if (phase === 'select-second-edge') {
      previewEdgeRef.current = { x: nx, y: ny };
    } else if (phase === 'select-first-edge') {
      // Update hover state for cursor
      setHoverIndex(hitTestPlacedPlayers(nx, ny));
    }
  }, [isInteractive, phase, hitTestPlacedPlayers]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      e.preventDefault();
      if (dragPosRef.current && dragIndexRef.current >= 0 && dragIndexRef.current < placedPlayersRef.current.length) {
        placedPlayersRef.current[dragIndexRef.current].currentCenter = { ...dragPosRef.current };
      }
      dragPosRef.current = null;
      dragIndexRef.current = -1;
    }
  }, []);

  // Wheel: resize placed player under cursor (native listener to avoid passive violation)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isInteractive) return;

    const handleWheel = (e: WheelEvent) => {
      const rect = canvas.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;

      // If dragging, resize the dragged player
      if (isDraggingRef.current && dragIndexRef.current >= 0) {
        e.preventDefault();
        const scaleDelta = e.deltaY > 0 ? SCALE_STEP_DOWN : SCALE_STEP_UP;
        const p = placedPlayersRef.current[dragIndexRef.current];
        if (p) p.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, p.scale * scaleDelta));
        return;
      }

      // Otherwise, resize whichever player is under cursor
      const hitIdx = hitTestPlacedPlayers(nx, ny);
      if (hitIdx >= 0) {
        e.preventDefault();
        const scaleDelta = e.deltaY > 0 ? SCALE_STEP_DOWN : SCALE_STEP_UP;
        const p = placedPlayersRef.current[hitIdx];
        p.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, p.scale * scaleDelta));
      }
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [isInteractive, hitTestPlacedPlayers]);

  // Keyboard: Escape = clear all, Backspace = undo, Arrows = resize
  useEffect(() => {
    if (!isInteractive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (phase === 'select-second-edge') {
          // Cancel current selection, go back to first-edge
          previewEdgeRef.current = null;
          dispatch({
            type: 'SET_MOVE_PLAYER_STATE',
            state: { phase: 'select-first-edge', moveCount: state.movePlayerState?.moveCount ?? 0 },
          });
        } else {
          dispatch({ type: 'CLEAR_MOVE_PLAYER_STATE' });
        }
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        if (isDraggingRef.current && dragIndexRef.current >= 0) {
          // Remove the player being dragged
          placedPlayersRef.current.splice(dragIndexRef.current, 1);
          isDraggingRef.current = false;
          dragPosRef.current = null;
          dragIndexRef.current = -1;
        } else if (placedPlayersRef.current.length > 0) {
          // Undo last placed player
          placedPlayersRef.current.pop();
        }
        dispatch({
          type: 'SET_MOVE_PLAYER_STATE',
          state: {
            phase: 'select-first-edge',
            moveCount: Math.max(0, placedPlayersRef.current.length),
          },
        });
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const scaleDelta = e.key === 'ArrowUp' ? SCALE_STEP_UP : SCALE_STEP_DOWN;
        // Resize the player being dragged, or the last placed player
        if (isDraggingRef.current && dragIndexRef.current >= 0) {
          const p = placedPlayersRef.current[dragIndexRef.current];
          if (p) p.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, p.scale * scaleDelta));
        } else if (hoverIndexRef.current >= 0) {
          const p = placedPlayersRef.current[hoverIndexRef.current];
          if (p) p.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, p.scale * scaleDelta));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInteractive, phase, state.movePlayerState, dispatch]);

  // Only run the render loop when there's something to draw
  const shouldRender = hasState && (isInteractive || placedPlayersRef.current.length > 0);

  // Render loop
  useEffect(() => {
    if (!shouldRender) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;

    const render = () => {
      if (!running) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width;
      const h = canvas.height;
      const renderW = w / dpr;
      const renderH = h / dpr;

      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.scale(dpr, dpr);

      const hasPlacedPlayers = placedPlayersRef.current.length > 0;
      const bg = backgroundRef.current;

      if (hasPlacedPlayers && bg) {
        // Draw background with inpainted holes
        ctx.drawImage(bg, 0, 0, renderW, renderH);

        const fw = bg.width;
        const fh = bg.height;
        const scaleX = renderW / fw;
        const scaleY = renderH / fh;

        // Draw each placed player
        for (let i = 0; i < placedPlayersRef.current.length; i++) {
          const p = placedPlayersRef.current[i];

          // Use drag position if this player is being dragged
          const center = (isDraggingRef.current && dragIndexRef.current === i && dragPosRef.current)
            ? dragPosRef.current
            : p.currentCenter;

          const origPx = { x: p.originalCenter.x * fw, y: p.originalCenter.y * fh };
          const curPx = { x: center.x * fw, y: center.y * fh };
          const dx = curPx.x - origPx.x;
          const dy = curPx.y - origPx.y;

          const baseX = (p.cutoutOrigin.x + dx) * scaleX;
          const baseY = (p.cutoutOrigin.y + dy) * scaleY;
          const drawW = p.cutout.width * scaleX;
          const drawH = p.cutout.height * scaleY;
          const cx = baseX + drawW / 2;
          const cy = baseY + drawH / 2;
          const sw = drawW * p.scale;
          const sh = drawH * p.scale;

          ctx.drawImage(p.cutout, cx - sw / 2, cy - sh / 2, sw, sh);

          // Green ground shadow — only on hovered or dragged player
          const isSelected = (isDraggingRef.current && dragIndexRef.current === i)
            || (!isDraggingRef.current && hoverIndexRef.current === i);
          if (isSelected) {
            const shadowCx = center.x * renderW;
            const shadowCy = center.y * renderH + (p.radiusY * renderH * p.scale * 0.85);
            const shadowRx = p.radiusX * renderW * p.scale * 0.5;
            const shadowRy = p.radiusY * renderH * p.scale * 0.15;

            ctx.beginPath();
            ctx.ellipse(shadowCx, shadowCy, shadowRx, shadowRy, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 255, 136, 0.25)';
            ctx.fill();
          }
        }
      }

      // Preview ellipse during second-edge selection
      if (phase === 'select-second-edge' && isInteractive) {
        const mp = state.movePlayerState;
        const firstEdge = mp?.firstEdge;
        const secondEdge = previewEdgeRef.current;
        if (firstEdge && secondEdge) {
          const cx = ((firstEdge.x + secondEdge.x) / 2) * renderW;
          const cy = ((firstEdge.y + secondEdge.y) / 2) * renderH;
          const rx = (Math.abs(secondEdge.x - firstEdge.x) / 2) * renderW;
          const ry = (Math.abs(secondEdge.y - firstEdge.y) / 2) * renderH;

          if (rx > 2 || ry > 2) {
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          // First edge marker
          ctx.beginPath();
          ctx.arc(firstEdge.x * renderW, firstEdge.y * renderH, 4, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fill();
        }
      }

      // Hint pill (only when move-player tool is active)
      if (isInteractive) {
        const msg = phase === 'select-second-edge'
          ? 'Click opposite edge to complete selection'
          : hasPlacedPlayers
            ? 'Select player  ·  Drag to reposition  ·  Scroll to resize  ·  Backspace: undo'
            : 'Click one edge of the player to select';
        renderHintPill(ctx, msg, renderW, renderH);
      }

      ctx.restore();
      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldRender, isInteractive, phase]);

  if (!hasState) return null;

  // Cursor: grab when hovering a placed player, crosshair otherwise
  let cursor = 'crosshair';
  if (!isInteractive) {
    cursor = 'default';
  } else if (isDraggingRef.current) {
    cursor = 'grabbing';
  } else if (hoverIndex >= 0) {
    cursor = 'grab';
  }

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onContextMenu={handleContextMenu}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 4,
        pointerEvents: isInteractive ? 'auto' : 'none',
        cursor,
        touchAction: 'none',
      }}
    />
  );
}

export const MovePlayerOverlay = forwardRef(MovePlayerOverlayInner);

// --- Helper rendering functions ---

function renderHintPill(
  ctx: CanvasRenderingContext2D,
  text: string,
  renderW: number,
  renderH: number,
) {
  ctx.font = '12px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  const textW = ctx.measureText(text).width;
  const pillW = textW + 24;
  const pillH = 26;
  const pillX = renderW / 2 - pillW / 2;
  const pillY = renderH - 100;

  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillW, pillH, 13);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillText(text, renderW / 2, pillY + 17);
}

/** Draw a placed player's cutout at its current position with scale, in frame coords. */
function drawScaledCutout(
  ctx: CanvasRenderingContext2D,
  p: PlacedPlayer,
  frameW: number,
  frameH: number,
) {
  const origPx = { x: p.originalCenter.x * frameW, y: p.originalCenter.y * frameH };
  const curPx = { x: p.currentCenter.x * frameW, y: p.currentCenter.y * frameH };
  const dx = curPx.x - origPx.x;
  const dy = curPx.y - origPx.y;

  const baseX = p.cutoutOrigin.x + dx;
  const baseY = p.cutoutOrigin.y + dy;
  const w = p.cutout.width;
  const h = p.cutout.height;

  const cx = baseX + w / 2;
  const cy = baseY + h / 2;
  const sw = w * p.scale;
  const sh = h * p.scale;

  ctx.drawImage(p.cutout, cx - sw / 2, cy - sh / 2, sw, sh);
}
