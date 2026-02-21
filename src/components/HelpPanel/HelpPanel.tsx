import { useThemeColors } from '../../hooks/useThemeColors';

interface PatternProps {
  name: string;
  description: string;
  steps: string[];
}

function Pattern({ name, description, steps }: PatternProps) {
  const theme = useThemeColors();
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 600, color: theme.secondary, fontSize: 12, marginBottom: 4 }}>
        {name}
      </div>
      <div style={{ color: theme.textMuted, fontSize: 11, lineHeight: 1.5, marginBottom: 6 }}>
        {description}
      </div>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        paddingLeft: 8,
        borderLeft: `2px solid ${theme.highlight}`,
      }}>
        {steps.map((step, i) => (
          <div key={i} style={{ color: theme.textMuted, fontSize: 10, lineHeight: 1.5 }}>
            <span style={{ color: theme.highlight, fontWeight: 600, marginRight: 4 }}>{i + 1}.</span>
            {step}
          </div>
        ))}
      </div>
    </div>
  );
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

export function HelpPanel() {
  const theme = useThemeColors();
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
        <SectionHeader>Animation Patterns</SectionHeader>

        <Pattern
          name="Pass and Go"
          description="A player passes the ball and then runs into a new position."
          steps={[
            'Draw a passing line from a player to the target',
            'Draw a running line from the same player to their new position',
            'The pass animates first, then the run',
          ]}
        />

        <Pattern
          name="Move to Receive"
          description="A player runs into space to receive a pass."
          steps={[
            'Draw a running line from the receiving player to their target position',
            'Draw a passing line ending at that same player',
            'The run animates first, then the pass arrives',
          ]}
        />

        <Pattern
          name="Receive and Advance"
          description="A player receives a pass and then dribbles forward into space."
          steps={[
            'Draw a passing line ending at the receiving player',
            'Draw a dribble line from that player to where they advance',
            'The pass arrives first, then the player dribbles',
          ]}
        />

        <Pattern
          name="One-Touch Relay"
          description="The ball is passed through multiple players in a chain."
          steps={[
            'Draw a passing line from player A to player B',
            'Draw a passing line from player B to player C',
            'Each pass animates sequentially in order',
          ]}
        />

        <Pattern
          name="Wall Pass (One-Two)"
          description="A player passes to a teammate, runs past the defender, and receives the return ball."
          steps={[
            'Draw a passing line from player A to player B',
            'Draw a running line from player A to their new position',
            'Draw a passing line from player B back to player A',
            'Animates as: pass, run, return pass',
          ]}
        />

        <div style={{ height: 1, background: theme.border, margin: '16px 0' }} />

        <SectionHeader>Tips</SectionHeader>

        <Tip>
          Lines automatically snap to players when drawn from or to them — this is what enables auto-ordering.
        </Tip>
        <Tip>
          Override auto-ordering by manually setting animation steps: click a line, then choose a step number.
        </Tip>
        <Tip>
          Off-ball runs by different players animate simultaneously when there are no dependencies between them.
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
