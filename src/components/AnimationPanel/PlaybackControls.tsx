import type { PlaybackStatus } from '../../animation/playbackController';
import { useThemeColors } from '../../hooks/useThemeColors';

const SPEED_OPTIONS = [0.25, 0.5, 1, 1.5, 2];

interface PlaybackControlsProps {
  status: PlaybackStatus;
  currentIndex: number;
  progress: number;
  totalKeyframes: number;
  speedMultiplier: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeekStart: () => void;
  onSeekEnd: () => void;
  onSpeedChange: (speed: number) => void;
}

function ControlButton({
  onClick,
  title,
  disabled,
  children,
  theme,
}: {
  onClick: () => void;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
  theme: { textSubtle: string; secondary: string; surfaceHover: string };
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        borderRadius: 4,
        background: 'transparent',
        color: disabled ? theme.textSubtle : theme.secondary,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
        padding: 0,
      }}
      onMouseEnter={e => {
        if (!disabled) {
          e.currentTarget.style.background = theme.surfaceHover;
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      {children}
    </button>
  );
}

export function PlaybackControls({
  status,
  currentIndex,
  progress,
  totalKeyframes,
  speedMultiplier,
  onPlay,
  onPause,
  onStop,
  onPrev,
  onNext,
  onSeekStart,
  onSeekEnd,
  onSpeedChange,
}: PlaybackControlsProps) {
  const theme = useThemeColors();
  const isPlaying = status === 'playing';
  const hasFrames = totalKeyframes >= 2;

  // Compute overall progress for scrubber
  const totalTransitions = Math.max(1, totalKeyframes - 1);
  const overallProgress = hasFrames
    ? (currentIndex + progress) / totalTransitions
    : 0;

  const nextSpeedIndex = SPEED_OPTIONS.indexOf(speedMultiplier);
  const handleSpeedCycle = () => {
    const nextIdx = (nextSpeedIndex + 1) % SPEED_OPTIONS.length;
    onSpeedChange(SPEED_OPTIONS[nextIdx]);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 12px',
        background: theme.surface,
        borderTop: `1px solid ${theme.border}`,
        minHeight: 36,
      }}
    >
      {/* Transport controls */}
      <ControlButton onClick={onSeekStart} title="Jump to start" disabled={!hasFrames} theme={theme}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <rect x="4" y="5" width="3" height="14" />
          <polygon points="20,5 20,19 9,12" />
        </svg>
      </ControlButton>

      <ControlButton onClick={onPrev} title="Previous keyframe (Left arrow)" disabled={!hasFrames} theme={theme}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="18,5 18,19 6,12" />
        </svg>
      </ControlButton>

      {/* Play / Pause */}
      <button
        onClick={isPlaying ? onPause : onPlay}
        title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        disabled={!hasFrames}
        style={{
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          borderRadius: '50%',
          background: hasFrames ? theme.highlight : theme.borderSubtle,
          color: hasFrames ? theme.surface : '#6b7280',
          cursor: hasFrames ? 'pointer' : 'not-allowed',
          transition: 'all 0.15s',
          padding: 0,
        }}
      >
        {isPlaying ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="6,4 20,12 6,20" />
          </svg>
        )}
      </button>

      <ControlButton onClick={onNext} title="Next keyframe (Right arrow)" disabled={!hasFrames} theme={theme}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="6,5 6,19 18,12" />
        </svg>
      </ControlButton>

      <ControlButton onClick={onSeekEnd} title="Jump to end" disabled={!hasFrames} theme={theme}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="4,5 4,19 15,12" />
          <rect x="17" y="5" width="3" height="14" />
        </svg>
      </ControlButton>

      <ControlButton onClick={onStop} title="Stop" disabled={status === 'idle'} theme={theme}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <rect x="4" y="4" width="16" height="16" rx="2" />
        </svg>
      </ControlButton>

      {/* Scrubber */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', margin: '0 8px' }}>
        <div
          style={{
            flex: 1,
            height: 4,
            background: theme.borderSubtle,
            borderRadius: 2,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: `${overallProgress * 100}%`,
              background: theme.highlight,
              borderRadius: 2,
              transition: isPlaying ? 'none' : 'width 0.15s',
            }}
          />
        </div>
      </div>

      {/* Speed */}
      <button
        onClick={handleSpeedCycle}
        title="Playback speed (click to cycle)"
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: speedMultiplier === 1 ? theme.textMuted : theme.highlight,
          background: 'transparent',
          border: `1px solid ${theme.borderSubtle}`,
          borderRadius: 4,
          padding: '2px 6px',
          cursor: 'pointer',
          minWidth: 36,
          textAlign: 'center',
          transition: 'all 0.15s',
        }}
      >
        {speedMultiplier}x
      </button>

      {/* Frame indicator */}
      <span style={{ fontSize: 10, color: theme.textSubtle, minWidth: 40, textAlign: 'right' }}>
        {currentIndex + 1}/{totalKeyframes}
      </span>
    </div>
  );
}
