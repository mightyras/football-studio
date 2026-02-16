import { useCallback, useRef, useState } from 'react';
import { PITCH } from '../constants/pitch';
import type { ZoomPreset, ZoomState, PitchRotation } from '../types';

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const PITCH_CENTER_X = PITCH.length / 2;   // 52.5
const PITCH_CENTER_Y = PITCH.width / 2;    // 34

/**
 * Convert screen-space deltas (dx, dy) to world-space focus deltas (dfx, dfy)
 * accounting for the current rotation.
 *
 *  rot=0: screen-X ↔ world-Y,  screen-Y ↔ world-X
 *  rot=1: screen-X ↔ world-X,  screen-Y ↔ -world-Y
 *  rot=2: screen-X ↔ -world-Y, screen-Y ↔ -world-X
 *  rot=3: screen-X ↔ -world-X, screen-Y ↔ world-Y
 */
function screenDeltaToWorld(
  sdx: number, sdy: number, rot: PitchRotation, scale: number,
): { dfx: number; dfy: number } {
  switch (rot) {
    case 0: return { dfx: sdy / scale,  dfy: sdx / scale };
    case 1: return { dfx: sdx / scale,  dfy: -sdy / scale };
    case 2: return { dfx: -sdy / scale, dfy: -sdx / scale };
    case 3: return { dfx: -sdx / scale, dfy: sdy / scale };
  }
}

const PRESETS: Record<ZoomPreset, ZoomState> = {
  'full':          { zoom: 1, focusX: PITCH_CENTER_X, focusY: PITCH_CENTER_Y },
  'top-half':      { zoom: 2, focusX: PITCH.length * 0.25, focusY: PITCH_CENTER_Y },
  'bottom-half':   { zoom: 2, focusX: PITCH.length * 0.75, focusY: PITCH_CENTER_Y },
};

export function useZoom() {
  const [zoomState, setZoomState] = useState<ZoomState>(PRESETS['full']);
  const [activePreset, setActivePreset] = useState<ZoomPreset>('full');
  const [rotation, setRotation] = useState<PitchRotation>(0);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panStartFocus = useRef({ x: 0, y: 0 });

  const setPreset = useCallback((preset: ZoomPreset) => {
    setZoomState(PRESETS[preset]);
    setActivePreset(preset);
  }, []);

  const zoomIn = useCallback(() => {
    setZoomState(prev => ({
      ...prev,
      zoom: Math.min(MAX_ZOOM, prev.zoom + 0.2),
    }));
    setActivePreset('full');
  }, []);

  const zoomOut = useCallback(() => {
    setZoomState(prev => {
      const newZoom = Math.max(MIN_ZOOM, prev.zoom - 0.2);
      if (newZoom <= 1) return PRESETS['full'];
      return { ...prev, zoom: newZoom };
    });
    setActivePreset('full');
  }, []);

  const resetZoom = useCallback(() => {
    setZoomState(PRESETS['full']);
    setActivePreset('full');
  }, []);

  const handleWheel = useCallback((
    e: WheelEvent,
    screenToWorld: (sx: number, sy: number) => { x: number; y: number },
    scale: number,
  ) => {
    e.preventDefault();

    // Trackpad pinch-to-zoom fires as wheel with ctrlKey set
    const isPinchZoom = e.ctrlKey;

    if (isPinchZoom) {
      // Pinch-to-zoom: deltaY controls zoom level
      const delta = -e.deltaY * 0.01;

      setZoomState(prev => {
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.zoom + delta));

        if (newZoom <= 1) return PRESETS['full'];

        // Zoom toward the mouse position
        const mouseWorld = screenToWorld(e.offsetX, e.offsetY);
        const zoomRatio = newZoom / prev.zoom;
        const newFocusX = prev.focusX + (mouseWorld.x - prev.focusX) * (1 - 1 / zoomRatio);
        const newFocusY = prev.focusY + (mouseWorld.y - prev.focusY) * (1 - 1 / zoomRatio);

        return { zoom: newZoom, focusX: newFocusX, focusY: newFocusY };
      });
      setActivePreset('full');
    } else {
      // Two-finger swipe / scroll wheel:
      // When zoomed in → pan; when at 1x → zoom with vertical scroll
      setZoomState(prev => {
        if (prev.zoom > 1) {
          // Pan: translate screen deltas to world deltas, rotation-aware
          const { dfx, dfy } = screenDeltaToWorld(e.deltaX, e.deltaY, rotation, scale);
          const newFocusX = prev.focusX + dfx;
          const newFocusY = prev.focusY + dfy;
          return { ...prev, focusX: newFocusX, focusY: newFocusY };
        } else {
          // At zoom 1: scroll up = zoom in toward cursor
          const delta = -e.deltaY * 0.001;
          const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.zoom + delta * prev.zoom));
          if (newZoom <= 1) return PRESETS['full'];

          const mouseWorld = screenToWorld(e.offsetX, e.offsetY);
          const zoomRatio = newZoom / prev.zoom;
          const newFocusX = prev.focusX + (mouseWorld.x - prev.focusX) * (1 - 1 / zoomRatio);
          const newFocusY = prev.focusY + (mouseWorld.y - prev.focusY) * (1 - 1 / zoomRatio);

          return { zoom: newZoom, focusX: newFocusX, focusY: newFocusY };
        }
      });
      setActivePreset('full');
    }
  }, [rotation]);

  const startPan = useCallback((screenX: number, screenY: number) => {
    isPanning.current = true;
    panStart.current = { x: screenX, y: screenY };
    setZoomState(prev => {
      panStartFocus.current = { x: prev.focusX, y: prev.focusY };
      return prev;
    });
  }, []);

  const movePan = useCallback((screenX: number, screenY: number, scale: number) => {
    if (!isPanning.current) return;
    const dx = screenX - panStart.current.x;
    const dy = screenY - panStart.current.y;
    // Drag is inverted: moving mouse right should move focus left
    const { dfx, dfy } = screenDeltaToWorld(-dx, -dy, rotation, scale);
    setZoomState(prev => ({
      ...prev,
      focusX: panStartFocus.current.x + dfx,
      focusY: panStartFocus.current.y + dfy,
    }));
    setActivePreset('full');
  }, [rotation]);

  const endPan = useCallback(() => {
    isPanning.current = false;
  }, []);

  const rotateCW = useCallback(() => {
    setRotation(prev => ((prev + 3) % 4) as PitchRotation);
  }, []);

  const rotateCCW = useCallback(() => {
    setRotation(prev => ((prev + 1) % 4) as PitchRotation);
  }, []);

  return {
    zoomState,
    activePreset,
    isPanning,
    rotation,
    setPreset,
    zoomIn,
    zoomOut,
    resetZoom,
    handleWheel,
    startPan,
    movePan,
    endPan,
    rotateCW,
    rotateCCW,
  };
}
