import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnimationSequence } from '../types';
import { PlaybackController, type PlaybackStatus } from '../animation/playbackController';

export function usePlayback(sequence: AnimationSequence | null) {
  const controllerRef = useRef<PlaybackController | null>(null);
  const [status, setStatus] = useState<PlaybackStatus>('idle');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  // Create/update controller when sequence changes
  useEffect(() => {
    if (!sequence || sequence.keyframes.length === 0) {
      controllerRef.current = null;
      setStatus('idle');
      setCurrentIndex(0);
      setProgress(0);
      return;
    }

    const onFrame = (s: PlaybackStatus, idx: number, p: number) => {
      setStatus(s);
      setCurrentIndex(idx);
      setProgress(p);
    };

    if (controllerRef.current) {
      controllerRef.current.updateSequence(sequence);
    } else {
      controllerRef.current = new PlaybackController(sequence, onFrame);
    }
  }, [sequence]);

  const play = useCallback(() => {
    controllerRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    controllerRef.current?.pause();
  }, []);

  const stop = useCallback(() => {
    controllerRef.current?.stop();
  }, []);

  const seekToKeyframe = useCallback((index: number) => {
    controllerRef.current?.seekToKeyframe(index);
  }, []);

  const setSpeed = useCallback((speed: number) => {
    controllerRef.current?.setSpeed(speed);
  }, []);

  return {
    controllerRef,
    status,
    currentIndex,
    progress,
    play,
    pause,
    stop,
    seekToKeyframe,
    setSpeed,
  };
}
