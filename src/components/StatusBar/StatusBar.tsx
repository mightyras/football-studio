import { useAppState } from '../../state/AppStateContext';
import { useThemeColors } from '../../hooks/useThemeColors';

const TOOL_LABELS: Record<string, string> = {
  select: 'Select & Move',
  'add-player': 'Add Player',
  delete: 'Delete Player',
  'formation-move': 'Formation Move',
};

const DRAW_HELP: Record<string, string> = {
  'text': 'Click to place text',
  'passing-line': 'Click start point, then end point',
  'running-line': 'Click start point, then end point',
  'curved-run': 'Click start point, then end point — Shift flips arc direction',
  'dribble-line': 'Click start point, then end point',
  'polygon': 'Click to add vertices, double-click to finish',
  'player-polygon': 'Click players to add, double-click last to finish',
  'player-line': 'Click players to add, double-click last to finish',
  'ellipse': 'Click center, then drag to set size',
  'player-marking': 'Step 1: Click the player being marked (target)',
};

export function StatusBar() {
  const { state } = useAppState();
  const theme = useThemeColors();

  const hasValidCoords =
    state.mouseWorldX !== null &&
    state.mouseWorldY !== null &&
    isFinite(state.mouseWorldX) &&
    isFinite(state.mouseWorldY) &&
    state.mouseWorldX >= -5 &&
    state.mouseWorldX <= 110 &&
    state.mouseWorldY >= -5 &&
    state.mouseWorldY <= 73;

  const coordText = hasValidCoords
    ? `${state.mouseWorldX!.toFixed(1)}m, ${state.mouseWorldY!.toFixed(1)}m`
    : '—';

  // Derive contextual help text
  let helpText = '';
  if (state.activeTool === 'formation-move') {
    if (state.formationMoveTeam) {
      const teamName = state.formationMoveTeam === 'A' ? state.teamAName : state.teamBName;
      helpText = `Drag to move ${teamName} (excl. GK) — click other team to switch`;
    } else {
      helpText = 'Click a player to select their team';
    }
  } else if (state.activeTool === 'draw') {
    const dp = state.drawingInProgress;
    if (dp?.type === 'player-marking') {
      helpText = 'Step 2: Click the marking player (defender)';
    } else if (dp?.type === 'polygon') {
      helpText = 'Click to add vertices, double-click to finish';
    } else if (dp?.type === 'player-polygon') {
      helpText = 'Click another player, double-click last to finish';
    } else if (dp?.type === 'player-line') {
      helpText = 'Click another player, double-click last to finish';
    } else if (dp?.type === 'line') {
      helpText = state.drawSubTool === 'curved-run'
        ? 'Click end point — Shift flips arc direction'
        : 'Click end point';
    } else if (dp?.type === 'ellipse') {
      helpText = 'Drag to set size';
    } else {
      helpText = DRAW_HELP[state.drawSubTool] || '';
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        background: theme.surface,
        borderTop: `1px solid ${theme.border}`,
        height: 28,
        fontSize: 11,
        color: theme.textMuted,
        fontFamily: 'monospace',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', gap: 24 }}>
        <span>Tool: {state.activeTool === 'draw' ? `Draw — ${state.drawSubTool}` : TOOL_LABELS[state.activeTool]}</span>
        <span>Team: {state.activeTeam === 'A' ? state.teamAName : state.teamBName}</span>
      </div>
      {helpText && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            color: theme.highlight,
            whiteSpace: 'nowrap',
          }}
        >
          {helpText}
        </div>
      )}
      <div style={{ display: 'flex', gap: 24 }}>
        <span>{coordText}</span>
      </div>
    </div>
  );
}
