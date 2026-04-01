import { useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import { useAnalytics } from '../AnalyticsContext';

export function useHlsPlayer(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const hlsRef = useRef<Hls | null>(null);
  const { state, dispatch } = useAnalytics();

  const loadStream = useCallback((url: string) => {
    const video = videoRef.current;
    if (!video) return;

    // Destroy previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Direct video file (MP4/WebM/MOV) — use native HTML5 video
    if (!url.includes('.m3u8')) {
      video.src = url;
      video.addEventListener('loadedmetadata', () => {
        dispatch({ type: 'SET_STREAM_STATUS', status: 'playing' });
        video.play().catch(() => {});
      }, { once: true });
      video.addEventListener('error', () => {
        dispatch({
          type: 'SET_STREAM_STATUS',
          status: 'error',
          error: 'Failed to load video. The URL may be invalid or expired.',
        });
      }, { once: true });
      return;
    }

    // HLS stream — use hls.js
    if (Hls.isSupported()) {
      const hls = new Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
      });
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        dispatch({ type: 'SET_STREAM_STATUS', status: 'playing' });
        video.play().catch(() => {
          // Autoplay blocked — user will click play
        });
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              dispatch({
                type: 'SET_STREAM_STATUS',
                status: 'error',
                error: 'Network error loading stream. The URL may be invalid or the token may have expired.',
              });
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              dispatch({
                type: 'SET_STREAM_STATUS',
                status: 'error',
                error: 'Media error. Attempting to recover...',
              });
              hls.recoverMediaError();
              break;
            default:
              dispatch({
                type: 'SET_STREAM_STATUS',
                status: 'error',
                error: 'Failed to load stream. Please check the URL.',
              });
              hls.destroy();
              break;
          }
        }
      });

      hls.loadSource(url);
      hls.attachMedia(video);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS fallback (clip recording won't work)
      video.src = url;
      video.addEventListener('loadedmetadata', () => {
        dispatch({ type: 'SET_STREAM_STATUS', status: 'playing' });
        video.play().catch(() => {});
      }, { once: true });
      video.addEventListener('error', () => {
        dispatch({
          type: 'SET_STREAM_STATUS',
          status: 'error',
          error: 'Failed to load stream.',
        });
      }, { once: true });
    } else {
      dispatch({
        type: 'SET_STREAM_STATUS',
        status: 'error',
        error: 'Your browser does not support HLS playback. Please use Chrome, Edge, or Firefox.',
      });
    }
  }, [dispatch, videoRef]);

  // Sync video element events to state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => dispatch({ type: 'SET_CURRENT_TIME', time: video.currentTime });
    const onDurationChange = () => dispatch({ type: 'SET_DURATION', duration: video.duration });
    const onPlay = () => dispatch({ type: 'SET_IS_PLAYING', playing: true });
    const onPause = () => dispatch({ type: 'SET_IS_PLAYING', playing: false });

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [dispatch, videoRef]);

  // Load stream when resolvedStreamUrl changes
  useEffect(() => {
    if (state.resolvedStreamUrl) {
      loadStream(state.resolvedStreamUrl);
    }
  }, [state.resolvedStreamUrl, loadStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  return { hlsRef };
}
