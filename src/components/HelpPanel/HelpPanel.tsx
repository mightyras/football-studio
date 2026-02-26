import { useThemeColors } from '../../hooks/useThemeColors';
import { useTour } from '../Tour/useTour';
import { hexToRgba } from '../../utils/colorUtils';

interface HelpPanelProps {
  onStartTour?: () => void;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  const theme = useThemeColors();
  return (
    <div style={{
      fontSize: 10,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: theme.textSubtle,
      marginBottom: 10,
      marginTop: 16,
    }}>
      {children}
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  const theme = useThemeColors();
  return (
    <div style={{
      color: theme.textMuted,
      fontSize: 11,
      lineHeight: 1.5,
      paddingLeft: 12,
      position: 'relative',
      marginBottom: 6,
    }}>
      <span style={{ position: 'absolute', left: 0 }}>&#8226;</span>
      {children}
    </div>
  );
}

export function HelpPanel({ onStartTour }: HelpPanelProps = {}) {
  const theme = useThemeColors();
  const tour = useTour();
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 14px',
      }}>
        {/* Take a Tour button */}
        <button
          onClick={() => {
            onStartTour?.();
            tour.start();
          }}
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'inherit',
            border: `1px solid ${theme.highlight}`,
            borderRadius: 6,
            background: hexToRgba(theme.highlight, 0.1),
            color: theme.highlight,
            cursor: 'pointer',
            transition: 'all 0.15s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = hexToRgba(theme.highlight, 0.25);
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = hexToRgba(theme.highlight, 0.1);
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none" />
          </svg>
          Take a Tour
        </button>

        <SectionHeader>Tips</SectionHeader>

        <Tip>
          Drag players to position them anywhere on the pitch.
        </Tip>
        <Tip>
          Double-click a player to edit their name, number, or label.
        </Tip>
        <Tip>
          Use the Draw tool (W) to add passing lines, running lines, and annotations.
        </Tip>
        <Tip>
          Undo any action with <strong style={{ color: theme.secondary }}>&#8984;Z</strong> / <strong style={{ color: theme.secondary }}>Ctrl+Z</strong>.
        </Tip>

        <div style={{ height: 1, background: theme.border, margin: '16px 0' }} />

        <SectionHeader>Keyboard Shortcuts</SectionHeader>

        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '4px 8px', fontSize: 11 }}>
          {([
            ['V', 'Select & Move'],
            ['X', 'Formation Move'],
            ['A', 'Add Player'],
            ['D', 'Delete Player'],
            ['W', 'Draw Tool'],
            ['F', 'Animation Mode'],
            ['O', 'Toggle Orientation'],
            ['C', 'Toggle Cover Shadow'],
            ['P', 'Passing Line'],
            ['R', 'Running Line'],
            ['Shift', 'Flip arc direction (curved run)'],
            ['B', 'Dribble Line'],
            ['T', 'Text'],
            ['E', 'Ellipse'],
            ['G', 'Polygon'],
            ['L', 'Player Line'],
            ['H', 'Player Polygon'],
            ['M', 'Player Marking'],
          ] as const).map(([key, label]) => (
            <div key={key} style={{ display: 'contents' }}>
              <span style={{
                color: theme.secondary,
                fontFamily: 'monospace',
                fontSize: 10,
                background: theme.border,
                padding: '1px 6px',
                borderRadius: 3,
                textAlign: 'center',
                display: 'inline-block',
              }}>
                {key}
              </span>
              <span style={{ color: theme.textMuted }}>{label}</span>
            </div>
          ))}
        </div>

        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}
