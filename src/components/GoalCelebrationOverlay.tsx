import { useEffect, useState } from 'react';
import type { GoalCelebration } from '../types';

interface GoalCelebrationOverlayProps {
  celebration: GoalCelebration;
  onDismiss: () => void;
}

export function GoalCelebrationOverlay({ celebration, onDismiss }: GoalCelebrationOverlayProps) {
  const [phase, setPhase] = useState<'in' | 'out'>('in');

  useEffect(() => {
    // After 2s, start fade-out
    const fadeTimer = setTimeout(() => setPhase('out'), 2000);
    // After 3s total, dismiss entirely
    const dismissTimer = setTimeout(onDismiss, 3000);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(dismissTimer);
    };
  }, [onDismiss]);

  const playerLabel = celebration.scorerName
    ? `#${celebration.scorerNumber} ${celebration.scorerName}`
    : `#${celebration.scorerNumber}`;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        pointerEvents: 'none',
        animation: phase === 'in'
          ? 'goalCelebIn 0.4s ease-out forwards'
          : 'goalCelebOut 1s ease-in forwards',
      }}
    >
      <div
        style={{
          fontSize: 64,
          fontWeight: 900,
          color: '#ffffff',
          textShadow: `0 0 40px ${celebration.teamColor}, 0 4px 12px rgba(0,0,0,0.7)`,
          letterSpacing: 8,
          fontFamily: 'inherit',
        }}
      >
        GOAL!
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: '#e2e8f0',
          textShadow: '0 2px 8px rgba(0,0,0,0.8)',
          marginTop: 8,
        }}
      >
        {celebration.teamName} — {playerLabel}
      </div>
      <style>{`
        @keyframes goalCelebIn {
          from { opacity: 0; transform: scale(0.5); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes goalCelebOut {
          from { opacity: 1; transform: scale(1); }
          to { opacity: 0; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
