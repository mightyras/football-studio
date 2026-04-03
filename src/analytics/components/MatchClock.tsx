import { useAnalytics } from '../AnalyticsContext';
import { computeMatchMinute } from '../utils/matchClock';

const PERIOD_LABELS: Record<string, string> = {
  pre_match: 'PRE-MATCH',
  '1st_half': '1ST HALF',
  halftime: 'HALFTIME',
  '2nd_half': '2ND HALF',
  full_time: 'FULL TIME',
};

export function MatchClock() {
  const { state } = useAnalytics();
  const clockState = computeMatchMinute(state.currentTime, state.bookmarks);

  if (!clockState) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 5,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: 8,
        padding: '8px 18px 6px',
        minWidth: 110,
      }}
    >
      {/* Main time display */}
      <div
        style={{
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: 20,
          fontWeight: 700,
          color: '#ffffff',
          lineHeight: 1,
          letterSpacing: '1px',
        }}
      >
        {clockState.display}
      </div>

      {/* Period label */}
      <div
        style={{
          fontSize: 9,
          fontWeight: 600,
          color: 'rgba(255, 255, 255, 0.45)',
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          marginTop: 4,
        }}
      >
        {PERIOD_LABELS[clockState.period]}
      </div>
    </div>
  );
}
