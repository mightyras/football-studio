import { useRef, useEffect, useCallback } from 'react';
import { useAnalytics } from '../AnalyticsContext';
import {
  renderStrokeToCanvas,
  renderMarkerToCanvas,
  computeLiveStrokeOpacity,
  isDotAnnotation,
  PEN_BASE_OPACITY,
} from '../utils/strokeRenderer';
import type { VideoAnnotation } from '../types';

type Props = {
  /** The video element to overlay (used for sizing fallback) */
  videoElement: HTMLVideoElement | null;
  /** 'live' = ephemeral wall-clock fading; 'clip' = video-time-based fading */
  mode: 'live' | 'clip';
  /** External annotations to render (e.g. from a saved clip) */
  externalAnnotations?: VideoAnnotation[];
  /** Current video time in seconds (required for clip mode) */
  currentVideoTime?: number;
  /** Reserve space at bottom for video controls (px). Pointer events pass through this area. */
  controlsHeight?: number;
};

/** Minimum screen-pixel distance between consecutive points during drawing */
const POINT_DECIMATION_PX = 2;

/** How long to wait after the last stroke before starting the fade (ms) */
const FADE_IDLE_MS = 2000;

export function VideoDrawingOverlay({
  videoElement,
  mode,
  externalAnnotations,
  currentVideoTime,
  controlsHeight = 0,
}: Props) {
  const { state, dispatch } = useAnalytics();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const isDrawingRef = useRef(false);
  const pointsRef = useRef<{ x: number; y: number }[]>([]);
  const drawColorRef = useRef(state.activeColor);
  const drawWidthRef = useRef(state.activeLineWidth);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingRemoveRef = useRef(false);
  const holdRef = useRef(state.holdStrokesOnPause);
  const isPlayingRef = useRef(state.isPlaying);

  // Keep refs in sync with state
  drawColorRef.current = state.activeColor;
  drawWidthRef.current = state.activeLineWidth;
  holdRef.current = state.holdStrokesOnPause;
  isPlayingRef.current = state.isPlaying;

  const isPenActive = state.activeTool === 'freehand';

  // ── Canvas sizing ──

  const updateCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const dpr = window.devicePixelRatio || 1;
    const w = parent.clientWidth;
    const h = parent.clientHeight - controlsHeight;
    if (h <= 0 || w <= 0) return;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
  }, [controlsHeight]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    updateCanvasSize();

    const ro = new ResizeObserver(updateCanvasSize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    return () => ro.disconnect();
  }, [updateCanvasSize]);

  // Clean up fade timer on unmount
  useEffect(() => {
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  // When hold is toggled ON: cancel pending fade and restore mid-fade strokes
  // When hold is toggled OFF: start the fade timer so strokes fade after the normal delay
  const prevHoldRef = useRef(state.holdStrokesOnPause);
  useEffect(() => {
    const wasHeld = prevHoldRef.current;
    prevHoldRef.current = state.holdStrokesOnPause;

    if (state.holdStrokesOnPause && !wasHeld) {
      // Turned ON — cancel timer and restore strokes
      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = undefined;
      }
      dispatch({ type: 'UNSTAMP_FREEHAND_FADE' });
    } else if (!state.holdStrokesOnPause && wasHeld) {
      // Turned OFF — start the fade timer for any visible strokes
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = setTimeout(() => {
        const videoTime = mode === 'clip' ? (videoElement?.currentTime ?? 0) : undefined;
        dispatch({ type: 'STAMP_FREEHAND_FADE_START', time: performance.now(), videoTime });
      }, FADE_IDLE_MS);
    }
  }, [state.holdStrokesOnPause, dispatch, mode, videoElement]);

  // ── Drawing interaction ──

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isPenActive) return;
    e.preventDefault();
    e.stopPropagation();

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Cancel any pending fade — user is drawing again
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = undefined;
    }

    // Bring mid-fade strokes back to full opacity
    dispatch({ type: 'UNSTAMP_FREEHAND_FADE' });

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    isDrawingRef.current = true;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    pointsRef.current = [{ x, y }];
  }, [isPenActive]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // Point decimation — skip if too close to the last point
    const pts = pointsRef.current;
    if (pts.length > 0) {
      const last = pts[pts.length - 1];
      const dx = (x - last.x) * rect.width;
      const dy = (y - last.y) * rect.height;
      if (dx * dx + dy * dy < POINT_DECIMATION_PX * POINT_DECIMATION_PX) return;
    }

    pts.push({ x, y });
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    isDrawingRef.current = false;
    const pts = pointsRef.current;

    if (pts.length >= 1) {
      // For dots (click with no/minimal drag), store as a single center point
      const finalPoints = isDotAnnotation(pts)
        ? [{ x: pts[0].x, y: pts[0].y }]
        : [...pts];

      // Only create stroke annotations if there are at least 2 points
      if (finalPoints.length === 1 || pts.length >= 2) {
        const annotation: VideoAnnotation = {
          id: crypto.randomUUID(),
          type: 'freehand',
          color: drawColorRef.current,
          lineWidth: drawWidthRef.current,
          points: finalPoints,
          // Don't set drawnAt/timeIn/timeOut yet — wait for the idle timer
          // so all strokes drawn in quick succession fade together
        };

        dispatch({ type: 'ADD_ANNOTATION', annotation });
      }

      // Restart the idle timer — fade starts only after 2s of no drawing
      // When hold is on, don't start the fade timer — strokes stay until cleared
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      if (!holdRef.current) {
        fadeTimerRef.current = setTimeout(() => {
          const videoTime = mode === 'clip' ? (videoElement?.currentTime ?? 0) : undefined;
          dispatch({ type: 'STAMP_FREEHAND_FADE_START', time: performance.now(), videoTime });
        }, FADE_IDLE_MS);
      }
    }

    pointsRef.current = [];
  }, [dispatch, mode, videoElement]);

  // ── Render loop ──

  const freehandAnnotations = state.annotations.filter(a => a.type === 'freehand');
  const allAnnotations = externalAnnotations
    ? [...freehandAnnotations, ...externalAnnotations.filter(a => a.type === 'freehand')]
    : freehandAnnotations;
  const hasStrokes = allAnnotations.length > 0;

  // Keep a ref to annotations so the rAF loop always sees the latest
  const allAnnotationsRef = useRef(allAnnotations);
  allAnnotationsRef.current = allAnnotations;
  const freehandAnnotationsRef = useRef(freehandAnnotations);
  freehandAnnotationsRef.current = freehandAnnotations;

  // Run the render loop whenever the pen is active OR there are strokes to render/fade
  const shouldRun = isPenActive || hasStrokes;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!shouldRun) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    let running = true;

    const render = () => {
      if (!running) return;

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.scale(dpr, dpr);

      const renderW = w / dpr;
      const renderH = h / dpr;
      const now = performance.now();
      const fadedIds: string[] = [];

      // Render persisted/fading strokes and dot markers (per-color numbering)
      const dotCounters: Record<string, number> = {};
      for (const ann of allAnnotationsRef.current) {
        if (!ann.points || ann.points.length === 0) continue;

        let opacity: number;

        if (!ann.drawnAt) {
          opacity = PEN_BASE_OPACITY;
        } else if (mode === 'live') {
          if (!isPlayingRef.current && holdRef.current) {
            opacity = PEN_BASE_OPACITY;
          } else {
            opacity = computeLiveStrokeOpacity(ann.drawnAt, now);
          }
        } else {
          opacity = computeLiveStrokeOpacity(ann.drawnAt, now);
        }

        if (opacity <= 0.01) {
          fadedIds.push(ann.id);
          continue;
        }

        if (isDotAnnotation(ann.points)) {
          dotCounters[ann.color] = (dotCounters[ann.color] || 0) + 1;
          renderMarkerToCanvas(ctx, ann.points[0], ann.color, dotCounters[ann.color], opacity, renderW, renderH);
        } else if (ann.points.length >= 2) {
          renderStrokeToCanvas(ctx, ann.points, ann.color, ann.lineWidth, opacity, renderW, renderH);
        }
      }

      // Render in-progress stroke — directly from ref, no state round-trip
      if (isDrawingRef.current && pointsRef.current.length >= 2) {
        renderStrokeToCanvas(
          ctx,
          pointsRef.current,
          drawColorRef.current,
          drawWidthRef.current,
          PEN_BASE_OPACITY,
          renderW,
          renderH,
        );
      }

      ctx.restore();

      // Clean up fully faded annotations — dispatch once, not every frame
      if (fadedIds.length > 0 && mode === 'live' && !pendingRemoveRef.current) {
        const stateIds = new Set(freehandAnnotationsRef.current.map(a => a.id));
        const toRemove = fadedIds.filter(id => stateIds.has(id));
        if (toRemove.length > 0) {
          pendingRemoveRef.current = true;
          dispatch({ type: 'REMOVE_FADED_ANNOTATIONS', ids: toRemove });
          // Reset after React processes the update
          requestAnimationFrame(() => { pendingRemoveRef.current = false; });
        }
      }

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldRun, mode]);

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: controlsHeight,
        zIndex: 5,
        pointerEvents: isPenActive ? 'auto' : 'none',
        cursor: isPenActive ? 'crosshair' : 'default',
        touchAction: 'none',
      }}
    />
  );
}
