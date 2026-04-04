import { useCallback, useRef } from 'react';
import { useAnalytics } from '../AnalyticsContext';
import { formatTimestamp } from '../utils/time';
import { saveClip as saveClipToDb } from '../services/analysisService';
import { renderStrokeToCanvas, renderMarkerToCanvas, computeClipStrokeOpacity, isDotAnnotation } from '../utils/strokeRenderer';
import type { SessionClip, VideoAnnotation } from '../types';
import { MP4ClipEncoder, likelySupportsMp4 } from '../../animation/mp4Encoder';

export function useClipRecorder(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  onClipReady?: (clip: SessionClip) => void,
) {
  const { state, dispatch } = useAnalytics();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const mp4EncoderRef = useRef<MP4ClipEncoder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const startTimeRef = useRef<number>(0);
  const useMP4Ref = useRef(false);

  const sessionIdRef = useRef(state.sessionId);
  sessionIdRef.current = state.sessionId;
  const annotationsRef = useRef<VideoAnnotation[]>(state.annotations);
  annotationsRef.current = state.annotations;

  const startRecording = useCallback(() => {
    const video = videoRef.current;
    if (!video || state.inPoint === null || state.outPoint === null) return;
    if (state.outPoint <= state.inPoint) return;

    const clipDuration = state.outPoint - state.inPoint;
    if (clipDuration > 120) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1920;
    canvas.height = video.videoHeight || 1080;
    canvasRef.current = canvas;
    const ctx = canvas.getContext('2d')!;

    video.currentTime = state.inPoint;

    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);

      const useMP4 = likelySupportsMp4();
      useMP4Ref.current = useMP4;

      // Compositing function shared by both paths
      const compositeFrame = () => {
        if (video.readyState >= 2) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const freehandAnns = annotationsRef.current.filter(a => a.type === 'freehand');
          const dotCounters: Record<string, number> = {};
          for (const ann of freehandAnns) {
            if (!ann.points || ann.points.length === 0) continue;
            const opacity = computeClipStrokeOpacity(ann, video.currentTime);
            if (opacity <= 0.01) continue;
            if (isDotAnnotation(ann.points)) {
              dotCounters[ann.color] = (dotCounters[ann.color] || 0) + 1;
              renderMarkerToCanvas(ctx, ann.points[0], ann.color, dotCounters[ann.color], opacity, canvas.width, canvas.height);
            } else if (ann.points.length >= 2) {
              renderStrokeToCanvas(ctx, ann.points, ann.color, ann.lineWidth, opacity, canvas.width, canvas.height);
            }
          }
        }
      };

      // Shared clip finalization
      const finalizeClip = (blob: Blob, mimeType: string) => {
        cancelAnimationFrame(rafRef.current);
        if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);

        const downloadUrl = URL.createObjectURL(blob);

        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = 160;
        thumbCanvas.height = 90;
        const thumbCtx = thumbCanvas.getContext('2d');
        if (thumbCtx && canvasRef.current) {
          thumbCtx.drawImage(canvasRef.current, 0, 0, 160, 90);
        }
        const thumbnailUrl = thumbCanvas.toDataURL('image/jpeg', 0.7);

        const clip: SessionClip = {
          id: crypto.randomUUID(),
          type: 'video',
          mimeType,
          timestamp: state.inPoint!,
          inPoint: state.inPoint!,
          outPoint: state.outPoint!,
          blob,
          thumbnailUrl,
          downloadUrl,
          annotations: [...annotationsRef.current],
          label: `Clip ${formatTimestamp(state.inPoint!)}–${formatTimestamp(state.outPoint!)}`,
          createdAt: Date.now(),
        };

        dispatch({ type: 'SET_RECORDING_STATUS', status: 'idle' });
        dispatch({ type: 'SET_IN_POINT', time: null });
        dispatch({ type: 'SET_OUT_POINT', time: null });

        video.pause();
        canvasRef.current = null;

        if (onClipReady) {
          onClipReady(clip);
        } else {
          dispatch({ type: 'ADD_SESSION_CLIP', clip });
        }
      };

      if (useMP4) {
        // ── MP4 path (WebCodecs + mediabunny) ──
        let audioTrack: MediaStreamTrack | null = null;
        try {
          const videoStream = (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream?.();
          if (videoStream) {
            audioTrack = videoStream.getAudioTracks()[0] ?? null;
          }
        } catch { /* Audio capture may fail */ }

        const mp4Encoder = new MP4ClipEncoder({
          canvas,
          fps: 30,
          bitrate: 5_000_000,
          audioTrack,
        });
        mp4EncoderRef.current = mp4Encoder;

        let stopped = false;

        const drawFrame = () => {
          if (stopped) return;
          compositeFrame();
          mp4Encoder.captureFrame().catch(() => {});
          rafRef.current = requestAnimationFrame(drawFrame);
        };

        mp4Encoder.start().then(() => {
          drawFrame();

          dispatch({ type: 'SET_RECORDING_STATUS', status: 'recording' });
          startTimeRef.current = Date.now();
          elapsedIntervalRef.current = setInterval(() => {
            dispatch({ type: 'SET_RECORDING_ELAPSED', elapsed: (Date.now() - startTimeRef.current) / 1000 });
          }, 100);

          video.play().catch(() => {});

          setTimeout(async () => {
            if (stopped) return;
            stopped = true;
            cancelAnimationFrame(rafRef.current);
            try {
              const blob = await mp4Encoder.finalize();
              finalizeClip(blob, 'video/mp4');
            } catch {
              mp4Encoder.dispose();
            }
            mp4EncoderRef.current = null;
          }, clipDuration * 1000);
        }).catch(() => {
          // MP4 start failed — should not happen if likelySupportsMp4() was true
          mp4EncoderRef.current = null;
        });
      } else {
        // ── WebM path (MediaRecorder) ──
        const drawFrame = () => {
          compositeFrame();
          rafRef.current = requestAnimationFrame(drawFrame);
        };
        drawFrame();

        const stream = canvas.captureStream(30);

        try {
          const videoStream = (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream?.();
          if (videoStream) {
            const audioTracks = videoStream.getAudioTracks();
            audioTracks.forEach(track => stream.addTrack(track));
          }
        } catch { /* Audio capture may fail */ }

        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
          ? 'video/webm;codecs=vp9,opus'
          : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
            ? 'video/webm;codecs=vp9'
            : 'video/webm';

        const recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 5_000_000,
        });
        recorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'video/webm' });
          finalizeClip(blob, 'video/webm');
        };

        recorder.start(1000);
        dispatch({ type: 'SET_RECORDING_STATUS', status: 'recording' });

        startTimeRef.current = Date.now();
        elapsedIntervalRef.current = setInterval(() => {
          dispatch({ type: 'SET_RECORDING_ELAPSED', elapsed: (Date.now() - startTimeRef.current) / 1000 });
        }, 100);

        video.play().catch(() => {});

        setTimeout(() => {
          if (recorder.state === 'recording') {
            recorder.stop();
          }
        }, clipDuration * 1000);
      }
    };

    video.addEventListener('seeked', onSeeked);
  }, [videoRef, state.inPoint, state.outPoint, state.annotations, dispatch, onClipReady]);

  const stopRecording = useCallback(() => {
    if (mp4EncoderRef.current) {
      // MP4 path — finalize is handled by the timeout, but if stopped early
      // we need to trigger finalization
      cancelAnimationFrame(rafRef.current);
      const encoder = mp4EncoderRef.current;
      mp4EncoderRef.current = null;
      encoder.finalize().catch(() => encoder.dispose());
    } else if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
    const video = videoRef.current;
    if (video) video.pause();
  }, [videoRef]);

  /** Persist a clip to state + Supabase. Called after user confirms in preview. */
  const saveVideoClip = useCallback(async (clip: SessionClip, label: string) => {
    const updatedClip = { ...clip, label };
    dispatch({ type: 'ADD_SESSION_CLIP', clip: updatedClip });

    const currentSessionId = sessionIdRef.current;
    if (currentSessionId && clip.blob) {
      let thumbnailBlob: Blob | null = null;
      if (clip.thumbnailUrl) {
        try {
          const resp = await fetch(clip.thumbnailUrl);
          thumbnailBlob = await resp.blob();
        } catch { /* ignore */ }
      }

      const saved = await saveClipToDb(currentSessionId, {
        type: 'video',
        mimeType: clip.mimeType,
        blob: clip.blob,
        thumbnailBlob,
        label,
        timestamp: clip.timestamp,
        inPoint: clip.inPoint,
        outPoint: clip.outPoint,
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

  return { startRecording, stopRecording, saveVideoClip };
}
