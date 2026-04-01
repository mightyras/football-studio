import { useCallback } from 'react';
import { useAnalytics } from '../AnalyticsContext';
import { detectUrlType, extractUrlMetadata } from '../utils/urlDetector';
import { supabase } from '../../lib/supabase';

export function useStreamUrlResolver() {
  const { dispatch } = useAnalytics();

  const resolveUrl = useCallback(async (rawUrl: string) => {
    const detection = detectUrlType(rawUrl);
    dispatch({ type: 'SET_STREAM_URL', url: rawUrl });

    // Extract metadata (team names, date) from the URL
    const metadata = extractUrlMetadata(rawUrl);
    if (metadata) {
      dispatch({ type: 'SET_URL_METADATA', metadata });
    }

    if (detection.type === 'hls' || detection.type === 'mp4') {
      // Direct stream/video URL — use as-is
      dispatch({ type: 'SET_RESOLVED_STREAM_URL', url: rawUrl });
      return;
    }

    if (detection.type === 'known-platform' && detection.platform) {
      // Try to extract stream URL via Edge Function
      dispatch({ type: 'SET_STREAM_STATUS', status: 'resolving' });
      try {
        const { data, error } = await supabase!.functions.invoke('extract-stream-url', {
          body: { url: rawUrl, platform: detection.platform },
        });

        if (error) throw error;

        if (data?.streamUrl) {
          dispatch({ type: 'SET_RESOLVED_STREAM_URL', url: data.streamUrl });
          return;
        }

        // Extraction returned no URL — show platform-specific fallback guidance
        const hint = detection.platform === 'veo'
          ? 'For Veo: Open the match in Chrome, press F12 → Network → filter ".mp4" → copy the veocdn.com URL.'
          : detection.platform === 'expressen'
          ? 'For Expressen: Open the match, press play, then F12 → Console → paste:\ndocument.querySelector(\'mux-player\')?.shadowRoot?.querySelector(\'mux-video\')?.getAttribute(\'src\')'
          : detection.platform === 'minfotboll'
          ? 'For Min Fotboll: Open the match, press play, then F12 → Network → filter ".m3u8" → copy the master.m3u8 URL.'
          : 'Open the page in your browser, press F12 → Network tab → filter ".m3u8" or ".mp4" → copy the URL.';
        dispatch({
          type: 'SET_STREAM_STATUS',
          status: 'error',
          error: `Could not auto-detect stream. The video may require login.\n\n${hint}`,
        });
      } catch (err) {
        dispatch({
          type: 'SET_STREAM_STATUS',
          status: 'error',
          error: `Could not extract stream URL. The video may require login.\n\nTo find the stream manually: Open the page in Chrome, press F12 → Network → filter ".m3u8" or ".mp4" → copy the URL.`,
        });
      }
      return;
    }

    // Unknown URL — show guidance
    dispatch({
      type: 'SET_STREAM_STATUS',
      status: 'error',
      error: `This URL doesn't appear to be a stream. Please paste a direct .m3u8 stream URL.\n\nTo find it: Open the match page in your browser, press F12 → Network tab → filter ".m3u8" → copy the URL.`,
    });
  }, [dispatch]);

  return { resolveUrl };
}
