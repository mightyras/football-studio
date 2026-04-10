import { useCallback, useRef } from 'react';
import { useAnalytics } from '../AnalyticsContext';
import { formatTimestamp } from '../utils/time';
import { saveClip as saveClipToDb } from '../services/analysisService';
import { renderStrokeToCanvas, renderMarkerToCanvas, isDotAnnotation, PEN_BASE_OPACITY } from '../utils/strokeRenderer';
import type { SessionClip } from '../types';

export function useScreenshotCapture(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  onClipReady?: (clip: SessionClip) => void,
  /** Optional function that returns a clean composite canvas for the move-player overlay */
  getOverlayComposite?: () => HTMLCanvasElement | null,
) {
  const { state, dispatch } = useAnalytics();
  const sessionIdRef = useRef(state.sessionId);
  sessionIdRef.current = state.sessionId;
  // Keep a ref to the full-size canvas for thumbnail generation during persist
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const captureScreenshot = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Composite move-player overlay if present (clean composite at native resolution)
    const overlayCanvas = getOverlayComposite?.();
    if (overlayCanvas && overlayCanvas.width > 0 && overlayCanvas.height > 0) {
      ctx.drawImage(overlayCanvas, 0, 0, canvas.width, canvas.height);
    }

    // Composite visible freehand strokes and dot markers onto the screenshot
    const freehandAnnotations = state.annotations.filter(a => a.type === 'freehand');
    const dotCounters: Record<string, number> = {};
    for (const ann of freehandAnnotations) {
      if (!ann.points || ann.points.length === 0) continue;
      if (isDotAnnotation(ann.points)) {
        dotCounters[ann.color] = (dotCounters[ann.color] || 0) + 1;
        renderMarkerToCanvas(ctx, ann.points[0], ann.color, dotCounters[ann.color], PEN_BASE_OPACITY, canvas.width, canvas.height);
      } else if (ann.points.length >= 2) {
        renderStrokeToCanvas(ctx, ann.points, ann.color, ann.lineWidth, PEN_BASE_OPACITY, canvas.width, canvas.height);
      }
    }

    captureCanvasRef.current = canvas;

    canvas.toBlob((blob) => {
      if (!blob) return;

      const thumbnailUrl = URL.createObjectURL(blob);
      const timestamp = video.currentTime;

      const clip: SessionClip = {
        id: crypto.randomUUID(),
        type: 'screenshot',
        timestamp,
        blob,
        thumbnailUrl,
        downloadUrl: thumbnailUrl,
        annotations: [...state.annotations],
        label: `Screenshot ${formatTimestamp(timestamp)}`,
        createdAt: Date.now(),
      };

      if (onClipReady) {
        onClipReady(clip);
      } else {
        // Fallback: save directly (shouldn't happen with preview flow)
        dispatch({ type: 'ADD_SESSION_CLIP', clip });
      }
    }, 'image/png');
  }, [videoRef, state.annotations, dispatch, onClipReady, getOverlayComposite]);

  /** Persist a clip to state + Supabase. Called after user confirms in preview. */
  const saveScreenshot = useCallback(async (clip: SessionClip, label: string) => {
    const updatedClip = { ...clip, label };
    dispatch({ type: 'ADD_SESSION_CLIP', clip: updatedClip });

    // Persist to Supabase
    const currentSessionId = sessionIdRef.current;
    if (currentSessionId && clip.blob) {
      let thumbnailBlob: Blob | null = null;
      if (captureCanvasRef.current) {
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = 160;
        thumbCanvas.height = 90;
        const thumbCtx = thumbCanvas.getContext('2d');
        if (thumbCtx) {
          thumbCtx.drawImage(captureCanvasRef.current, 0, 0, 160, 90);
          thumbnailBlob = await new Promise<Blob | null>(resolve =>
            thumbCanvas.toBlob(b => resolve(b), 'image/jpeg', 0.7)
          );
        }
      }

      const saved = await saveClipToDb(currentSessionId, {
        type: 'screenshot',
        blob: clip.blob,
        thumbnailBlob,
        label,
        timestamp: clip.timestamp,
        annotations: clip.annotations,
      });

      if (saved) {
        dispatch({
          type: 'SET_CLIP_CLOUD_ID',
          localId: updatedClip.id,
          cloudId: saved.id,
          storagePath: saved.storage_path,
          thumbnailStoragePath: saved.thumbnail_path ?? undefined,
        });
      }
    }
  }, [dispatch]);

  return { captureScreenshot, saveScreenshot };
}
