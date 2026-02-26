import type { AnimationSequence, AppState, Annotation, AttackDirection, ClubIdentity, DrawSubTool, DrawingInProgress, GhostPlayer, Keyframe, PitchSettings, Player, PreviewGhost, SceneData, SubstitutePlayer, ToolType } from '../types';
import { PITCH } from '../constants/pitch';
import { THEME } from '../constants/colors';
import { FORMATIONS } from '../constants/formations';
import { defendsHighX, matchPlayersToPositions } from '../utils/formationMapping';
import { remoteActionFlag } from './remoteActionFlag';

/** Clamp a world coordinate to the playable area (pitch + green buffer) */
const clampX = (x: number) => Math.max(-PITCH.padding, Math.min(PITCH.length + PITCH.padding, x));
const clampY = (y: number) => Math.max(-PITCH.padding, Math.min(PITCH.width + PITCH.padding, y));

export type AppAction =
  | { type: 'SET_ACTIVE_TOOL'; tool: ToolType }
  | { type: 'SET_ACTIVE_TEAM'; team: 'A' | 'B' }
  | { type: 'RENAME_TEAM'; team: 'A' | 'B'; name: string }
  | { type: 'SET_TEAM_COLOR'; team: 'A' | 'B'; color: string }
  | { type: 'SET_TEAM_OUTLINE_COLOR'; team: 'A' | 'B'; color: string }
  | { type: 'SET_TEAM_DIRECTION'; direction: AttackDirection }
  | { type: 'SET_PITCH_SETTINGS'; settings: Partial<PitchSettings> }
  | { type: 'APPLY_FORMATION'; team: 'A' | 'B'; formationId: string }
  | { type: 'MOVE_PLAYER'; playerId: string; x: number; y: number }
  | { type: 'ADD_PLAYER'; player: Player }
  | { type: 'DELETE_PLAYER'; playerId: string }
  | { type: 'SELECT_PLAYER'; playerId: string | null }
  | { type: 'HOVER_PLAYER'; playerId: string | null }
  | { type: 'HOVER_NOTCH'; playerId: string | null }
  | { type: 'START_DRAG'; playerId: string; offsetX: number; offsetY: number }
  | { type: 'END_DRAG' }
  | { type: 'EDIT_PLAYER'; playerId: string; number?: number; name?: string }
  | { type: 'START_EDITING'; playerId: string }
  | { type: 'STOP_EDITING' }
  | { type: 'SET_MOUSE_WORLD'; x: number | null; y: number | null }
  | { type: 'MOVE_BALL'; x: number; y: number }
  | { type: 'SET_BALL_RADIUS'; radius: number }
  | { type: 'START_DRAG_BALL'; offsetX: number; offsetY: number }
  | { type: 'SELECT_BALL' }
  | { type: 'HOVER_BALL' }
  | { type: 'SET_PLAYER_RADIUS'; radius: number }
  | { type: 'ROTATE_PLAYER'; playerId: string; facing: number }
  | { type: 'START_ROTATE'; playerId: string; startAngle: number; startFacing: number }
  | { type: 'START_FORMATION_MOVE'; team: 'A' | 'B'; anchorX: number; anchorY: number }
  | { type: 'MOVE_FORMATION'; team: 'A' | 'B'; dx: number; dy: number }
  | { type: 'SET_FORMATION_MOVE_TEAM'; team: 'A' | 'B' | null }
  | { type: 'SET_POSSESSION'; possession: 'A' | 'B' | 'auto' }
  | { type: 'SET_SHOW_ORIENTATION'; show: boolean }
  | { type: 'SET_SHOW_COVER_SHADOW'; show: boolean }
  | { type: 'SET_SHOW_STEP_NUMBERS'; show: boolean }
  | { type: 'SET_AUTO_ORIENT_TO_BALL'; enabled: boolean }
  | { type: 'SET_FOV_MODE'; mode: 'off' | 'A' | 'B' | 'both' }
  | { type: 'SET_FOV_EXPANDED'; expanded: boolean }
  | { type: 'SET_SHOW_PLAYER_NAMES'; team: 'A' | 'B'; show: boolean }
  | { type: 'SET_CMD_HELD'; held: boolean }
  | { type: 'SET_SHIFT_HELD'; held: boolean }
  | { type: 'SET_PENDING_DELETE_PLAYER'; playerId: string | null }
  | { type: 'SET_ACTIVE_BENCH'; bench: 'A' | 'B' | null }
  | { type: 'ADD_SUBSTITUTE'; team: 'A' | 'B'; substitute: SubstitutePlayer }
  | { type: 'REMOVE_SUBSTITUTE'; team: 'A' | 'B'; substituteId: string }
  | { type: 'EDIT_SUBSTITUTE'; team: 'A' | 'B'; substituteId: string; number?: number; name?: string }
  | { type: 'SUBSTITUTE_PLAYER'; team: 'A' | 'B'; substituteId: string; playerId: string }
  | { type: 'SET_DRAW_SUB_TOOL'; subTool: DrawSubTool }
  | { type: 'ADD_ANNOTATION'; annotation: Annotation }
  | { type: 'DELETE_ANNOTATION'; annotationId: string }
  | { type: 'CLEAR_ALL_ANNOTATIONS' }
  | { type: 'MOVE_ANNOTATION'; annotationId: string; dx: number; dy: number }
  | { type: 'SELECT_ANNOTATION'; annotationId: string | null }
  | { type: 'START_DRAG_ANNOTATION'; annotationId: string; offsetX: number; offsetY: number; initRefX: number; initRefY: number }
  | { type: 'START_DRAWING'; drawing: DrawingInProgress }
  | { type: 'UPDATE_DRAWING'; drawing: DrawingInProgress }
  | { type: 'CANCEL_DRAWING' }
  | { type: 'START_EDITING_ANNOTATION'; annotationId: string }
  | { type: 'STOP_EDITING_ANNOTATION' }
  | { type: 'EDIT_ANNOTATION'; annotationId: string; changes: Partial<Annotation> }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'RESET'; defaultFormationId?: string }
  | { type: 'ENTER_ANIMATION_MODE' }
  | { type: 'EXIT_ANIMATION_MODE' }
  | { type: 'CAPTURE_KEYFRAME' }
  | { type: 'UPDATE_KEYFRAME'; index: number }
  | { type: 'DELETE_KEYFRAME'; index: number }
  | { type: 'REORDER_KEYFRAME'; from: number; to: number }
  | { type: 'SELECT_KEYFRAME'; index: number }
  | { type: 'SET_KEYFRAME_DURATION'; index: number; durationMs: number }
  | { type: 'SET_KEYFRAME_LABEL'; index: number; label: string }
  | { type: 'SET_ANIMATION_SPEED'; speedMultiplier: number }
  | { type: 'SET_ANIMATION_NAME'; name: string }
  | { type: 'CLEAR_ANIMATION' }
  | { type: 'LOAD_ANIMATION'; sequence: AnimationSequence }
  | { type: 'LOAD_SCENE'; data: SceneData }
  | { type: 'SET_CLUB_IDENTITY'; identity: Partial<ClubIdentity> }
  | { type: 'CLEAR_CLUB_IDENTITY' }
  | { type: 'SET_THEME_MODE'; mode: 'light' | 'dark' }
  | { type: 'SET_SHOW_LOGO_ON_MARKERS'; show: boolean }
  | { type: 'SET_TEAM_LOGO_URL'; url: string | null }
  | { type: 'EXECUTE_RUN'; playerId: string; x: number; y: number; facing: number; ghost: GhostPlayer; annotationId: string; ballX?: number; ballY?: number; animationType?: 'run' | 'pass' | 'dribble' }
  | { type: 'CLEAR_PLAYER_GHOSTS'; playerId: string }
  | { type: 'RESET_RUN'; playerId: string }
  | { type: 'STAMP_GHOST_FADE_START'; time: number };

export function defaultFacing(team: 'A' | 'B', dir: AttackDirection): number {
  return defendsHighX(team, dir) ? Math.PI : 0;
}

function formationToWorld(
  pos: { x: number; y: number },
  team: 'A' | 'B',
  teamADirection: AttackDirection,
): { x: number; y: number } {
  // pos.x is normalized depth from own goal (0 = near own GK, 1 = near opponent's goal)
  // Map into the team's own half: depth 0→~8% of pitch, depth 1→~55% (just past midfield)
  // This prevents opposing teams from overlapping each other.
  const halfStart = 0.08;   // near own goal (inside penalty area)
  const halfEnd   = 0.55;   // just past the halfway line
  const mappedDepth = halfStart + pos.x * (halfEnd - halfStart);

  if (defendsHighX(team, teamADirection)) {
    // Own goal at high-x (bottom), so GK at x≈105, forwards near midfield
    return {
      x: PITCH.length * (1 - mappedDepth),
      y: pos.y * PITCH.width,
    };
  } else {
    // Own goal at low-x (top), so GK at x≈0, forwards near midfield
    return {
      x: PITCH.length * mappedDepth,
      y: pos.y * PITCH.width,
    };
  }
}

function createDefaultPlayers(
  teamADirection: AttackDirection = 'up',
  teamAFormationId: string = '4-4-2',
): Player[] {
  const players: Player[] = [];
  const teamAFormation = FORMATIONS.find(f => f.id === teamAFormationId) || FORMATIONS[0];
  const teamBFormation = FORMATIONS.find(f => f.id === '4-4-2') || FORMATIONS[0];

  // GK sits near own goal: high-x (bottom) if defending high-x, low-x (top) otherwise
  const gkAX = defendsHighX('A', teamADirection) ? PITCH.length - 4 : 4;
  const gkBX = defendsHighX('B', teamADirection) ? PITCH.length - 4 : 4;

  const facingA = defaultFacing('A', teamADirection);
  const facingB = defaultFacing('B', teamADirection);

  // Team A (uses team's default formation)
  players.push({
    id: 'a-1', team: 'A', number: 1, name: 'GK', isGK: true,
    x: gkAX, y: PITCH.width / 2, facing: facingA,
  });
  teamAFormation.positions.forEach((pos, i) => {
    const world = formationToWorld(pos, 'A', teamADirection);
    players.push({
      id: `a-${i + 2}`, team: 'A', number: pos.defaultNumber, name: pos.role,
      x: world.x, y: world.y, facing: facingA,
    });
  });

  // Team B (always 4-4-2)
  players.push({
    id: 'b-1', team: 'B', number: 1, name: 'GK', isGK: true,
    x: gkBX, y: PITCH.width / 2, facing: facingB,
  });
  teamBFormation.positions.forEach((pos, i) => {
    const world = formationToWorld(pos, 'B', teamADirection);
    players.push({
      id: `b-${i + 2}`, team: 'B', number: pos.defaultNumber, name: pos.role,
      x: world.x, y: world.y, facing: facingB,
    });
  });

  return players;
}

const defaultBall = {
  x: PITCH.length / 2,
  y: PITCH.width / 2,
  radius: 1.0,
  rotationX: 0,
  rotationY: 0,
};

/**
 * Compute the resolved possession team from ball + player positions.
 * When `possession` is manual ('A' | 'B'), returns that directly.
 * When 'auto', finds nearest player with a sticky bias: the current team
 * keeps possession unless the other team's nearest player is significantly
 * closer (within 60% of the current team's nearest distance).
 */
export function computePossession(
  players: Player[],
  ball: { x: number; y: number },
  possession: 'A' | 'B' | 'auto',
  currentResolved: 'A' | 'B',
): 'A' | 'B' {
  if (possession !== 'auto') return possession;

  let nearestA = Infinity;
  let nearestB = Infinity;
  for (const p of players) {
    const d = (p.x - ball.x) ** 2 + (p.y - ball.y) ** 2;
    if (p.team === 'A' && d < nearestA) nearestA = d;
    if (p.team === 'B' && d < nearestB) nearestB = d;
  }

  // Sticky bias: the other team must be meaningfully closer to switch
  const SWITCH_BIAS = 0.6; // other team must be within 60% of current team's distance
  if (currentResolved === 'A') {
    return nearestB < nearestA * SWITCH_BIAS ? 'B' : 'A';
  } else {
    return nearestA < nearestB * SWITCH_BIAS ? 'A' : 'B';
  }
}

/** Push current players+ball+annotations+ghosts onto undoStack and clear redoStack.
 *  Skips the push when the action is from a remote collaborator (undo isolation). */
function withUndo(state: AppState): Pick<AppState, 'undoStack' | 'redoStack'> {
  // Remote actions skip the undo stack so each user only undoes their own actions
  if (remoteActionFlag.current) {
    return { undoStack: state.undoStack, redoStack: state.redoStack };
  }
  const snapshot = { players: state.players, ball: state.ball, annotations: state.annotations, ghostPlayers: state.ghostPlayers, ghostAnnotationIds: state.ghostAnnotationIds, previewGhosts: state.previewGhosts };
  return {
    undoStack: [...state.undoStack, snapshot].slice(-50),
    redoStack: [],
  };
}

/**
 * Rotate every off-ball player so they face the ball.
 * Players within `playerRadius * 1.5` of the ball are skipped (ball carrier).
 */
function autoOrientPlayers(
  players: Player[],
  ballX: number,
  ballY: number,
  playerRadius: number,
): Player[] {
  const thresholdSq = (playerRadius * 1.5) ** 2;
  const snap = Math.PI / 8; // 22.5° — matches ROTATE_PLAYER

  return players.map(p => {
    const dx = ballX - p.x;
    const dy = ballY - p.y;
    if (dx * dx + dy * dy < thresholdSq) return p;

    const raw = Math.atan2(dy, dx);
    const normalized = ((raw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const snapped = Math.round(normalized / snap) * snap;

    if (Math.abs(p.facing - snapped) < 0.001) return p;
    return { ...p, facing: snapped };
  });
}

export const initialState: AppState = {
  players: createDefaultPlayers('up'),
  ball: { ...defaultBall },
  selectedPlayerId: null,
  hoveredPlayerId: null,
  hoveredNotchPlayerId: null,
  editingPlayerId: null,
  dragTarget: null,
  ballSelected: false,
  ballHovered: false,
  activeTool: 'select',
  activeTeam: 'A',
  teamAName: 'My Team',
  teamBName: 'Opposition',
  teamAColor: THEME.teamA,
  teamBColor: THEME.teamB,
  teamAOutlineColor: '#000000',
  teamBOutlineColor: '#000000',
  playerRadius: 1.6,
  possession: 'auto',
  resolvedPossession: 'A',
  showOrientation: true,
  showCoverShadow: false,
  fovMode: 'off',
  fovExpanded: false,
  autoOrientToBall: false,
  teamADirection: 'up',
  teamAFormation: '4-4-2',
  teamBFormation: '4-4-2',
  showPlayerNamesA: true,
  showPlayerNamesB: true,
  pitchSettings: {
    grassColor: THEME.pitchGreen,
    stripeColor: THEME.pitchStripe,
    stripesEnabled: true,
    stripeOpacity: 1.0,
    stadiumEnabled: false,
    zoneOverlay: 'none' as const,
    zoneDirection: 'bottom-to-top' as const,
    zoneLineColor: '#38bdf8',
    zoneLineOpacity: 0.5,
    zoneLineWidth: 3,
    zoneTintOpacity: 1.0,
  },
  annotations: [],
  selectedAnnotationId: null,
  editingAnnotationId: null,
  drawSubTool: 'passing-line' as const,
  drawingInProgress: null,
  cmdHeld: false,
  shiftHeld: false,
  undoStack: [],
  redoStack: [],
  mouseWorldX: null,
  mouseWorldY: null,
  substitutesA: [],
  substitutesB: [],
  activeBench: null,
  animationMode: false,
  animationSequence: null,
  activeKeyframeIndex: null,
  showStepNumbers: true,
  clubIdentity: {
    logoDataUrl: null,
    primaryColor: null,
    secondaryColor: null,
    highlightColor: null,
    backgroundColor: null,
    clubName: null,
  },
  ghostPlayers: [],
  ghostAnnotationIds: [],
  previewGhosts: [],
  pendingDeletePlayerId: null,
  formationMoveTeam: null,
  themeMode: 'dark' as const,
  showLogoOnMarkers: false,
  teamALogoUrl: null,
};

export function appStateReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_ACTIVE_TOOL':
      return {
        ...state,
        activeTool: action.tool,
        selectedPlayerId: null,
        ballSelected: false,
        selectedAnnotationId: null,
        drawingInProgress: null,
        hoveredNotchPlayerId: null,
        // Clear formation-move team selection when switching away
        ...(action.tool !== 'formation-move' ? { formationMoveTeam: null } : {}),
      };

    case 'SET_ACTIVE_TEAM':
      return { ...state, activeTeam: action.team };

    case 'RENAME_TEAM': {
      const nameKey = action.team === 'A' ? 'teamAName' : 'teamBName';
      return { ...state, [nameKey]: action.name };
    }

    case 'SET_TEAM_COLOR': {
      const colorKey = action.team === 'A' ? 'teamAColor' : 'teamBColor';
      return { ...state, [colorKey]: action.color };
    }

    case 'SET_TEAM_OUTLINE_COLOR': {
      const outlineKey = action.team === 'A' ? 'teamAOutlineColor' : 'teamBOutlineColor';
      return { ...state, [outlineKey]: action.color };
    }

    case 'SET_TEAM_DIRECTION': {
      const undo = withUndo(state);
      const newDir = action.direction;
      const oldDir = state.teamADirection;
      let newPlayers = [...state.players];

      for (const team of ['A', 'B'] as const) {
        const formationId = team === 'A' ? state.teamAFormation : state.teamBFormation;
        const formation = formationId ? FORMATIONS.find(f => f.id === formationId) : null;
        if (!formation) continue;

        const outfield = newPlayers.filter(p => p.team === team && !p.isGK);
        // Read current positions using OLD direction, write to NEW direction
        const mapping = matchPlayersToPositions(outfield, formation.positions, team, oldDir);
        const gkX = defendsHighX(team, newDir) ? PITCH.length - 4 : 4;
        const face = defaultFacing(team, newDir);

        newPlayers = newPlayers.map(p => {
          if (p.team !== team) return p;
          if (p.isGK) return { ...p, x: gkX, y: PITCH.width / 2, facing: face };

          const targetPos = mapping.get(p.id);
          if (!targetPos) return p;

          const world = formationToWorld(targetPos, team, newDir);
          return { ...p, x: world.x, y: world.y, facing: face, name: targetPos.role, number: targetPos.defaultNumber };
        });
      }

      return {
        ...state, ...undo, teamADirection: newDir, players: newPlayers,
        resolvedPossession: computePossession(newPlayers, state.ball, state.possession, state.resolvedPossession),
      };
    }

    case 'SET_PITCH_SETTINGS':
      return { ...state, pitchSettings: { ...state.pitchSettings, ...action.settings } };

    case 'APPLY_FORMATION': {
      const formation = FORMATIONS.find(f => f.id === action.formationId);
      if (!formation) return state;
      const undo = withUndo(state);

      const outfield = state.players.filter(
        p => p.team === action.team && !p.isGK,
      );
      const mapping = matchPlayersToPositions(
        outfield,
        formation.positions,
        action.team,
        state.teamADirection,
      );

      const gkX = defendsHighX(action.team, state.teamADirection) ? PITCH.length - 4 : 4;
      const face = defaultFacing(action.team, state.teamADirection);

      const updatedPlayers = state.players.map(p => {
        if (p.team !== action.team) return p;
        if (p.isGK) return { ...p, x: gkX, y: PITCH.width / 2, facing: face, name: 'GK' };

        const targetPos = mapping.get(p.id);
        if (!targetPos) return p;

        const world = formationToWorld(targetPos, action.team, state.teamADirection);
        return { ...p, x: world.x, y: world.y, facing: face, name: targetPos.role, number: targetPos.defaultNumber };
      });

      const formationKey = action.team === 'A' ? 'teamAFormation' : 'teamBFormation';
      return {
        ...state, ...undo, players: updatedPlayers, [formationKey]: action.formationId,
        resolvedPossession: computePossession(updatedPlayers, state.ball, state.possession, state.resolvedPossession),
      };
    }

    case 'MOVE_PLAYER': {
      const clampedX = Math.max(0, Math.min(PITCH.length, action.x));
      const clampedY = Math.max(0, Math.min(PITCH.width, action.y));
      return {
        ...state,
        players: state.players.map(p =>
          p.id === action.playerId ? { ...p, x: clampedX, y: clampedY } : p,
        ),
      };
    }

    case 'MOVE_FORMATION': {
      const team = action.team;
      const highX = defendsHighX(team, state.teamADirection);

      // Move outfield players
      const updatedPlayers = state.players.map(p => {
        if (p.team !== team || p.isGK) return p;
        return { ...p, x: clampX(p.x + action.dx), y: clampY(p.y + action.dy) };
      });

      // Compute smart GK position from outfield state
      const outfield = updatedPlayers.filter(p => p.team === team && !p.isGK);
      if (outfield.length === 0) return { ...state, players: updatedPlayers };

      const baseline = highX ? PITCH.length - 4 : 4;
      const penaltyEdge = highX
        ? PITCH.length - PITCH.penaltyAreaLength
        : PITCH.penaltyAreaLength;
      const midline = PITCH.length / 2;

      // Default deepest defender position (normalized x≈0.12 mapped to world coords).
      // Uses the same halfStart/halfEnd as formationToWorld so GK sits at baseline
      // when the formation is at its default positions.
      const defaultDeepest = PITCH.length * (0.08 + 0.12 * (0.55 - 0.08)); // ≈14.32

      // Deepest outfield player (closest to own goal)
      const deepestX = highX
        ? Math.max(...outfield.map(p => p.x))
        : Math.min(...outfield.map(p => p.x));

      // How far the deepest defender has moved beyond its default position,
      // toward the midline. Progress 0 = at default, 1 = at midline.
      const defenderDefault = highX ? PITCH.length - defaultDeepest : defaultDeepest;
      const t = Math.max(0, Math.min(1,
        highX
          ? (defenderDefault - deepestX) / (defenderDefault - midline)
          : (deepestX - defenderDefault) / (midline - defenderDefault)
      ));
      const gkX = baseline + t * (penaltyEdge - baseline);

      // Lateral: GK gets 15% of formation's average offset from center
      const avgY = outfield.reduce((sum, p) => sum + p.y, 0) / outfield.length;
      const centerY = PITCH.width / 2;
      const gkY = centerY + (avgY - centerY) * 0.15;

      const finalPlayers = updatedPlayers.map(p =>
        p.team === team && p.isGK ? { ...p, x: gkX, y: gkY } : p
      );

      return { ...state, players: finalPlayers };
    }

    case 'ADD_PLAYER': {
      const newPlayers = [...state.players, action.player];
      return {
        ...state, ...withUndo(state), players: newPlayers,
        resolvedPossession: computePossession(newPlayers, state.ball, state.possession, state.resolvedPossession),
      };
    }

    case 'DELETE_PLAYER': {
      // Cascade-clean annotations referencing this player
      const cleanedAnnotations = state.annotations
        .map(ann => {
          if (ann.type === 'player-line') {
            const remaining = ann.playerIds.filter(id => id !== action.playerId);
            if (remaining.length < 2) return null; // remove if fewer than 2 players
            return { ...ann, playerIds: remaining };
          }
          if (ann.type === 'player-polygon') {
            const remaining = ann.playerIds.filter(id => id !== action.playerId);
            if (remaining.length < 3) return null; // remove if fewer than 3 players
            return { ...ann, playerIds: remaining };
          }
          if (ann.type === 'player-marking') {
            if (ann.markedPlayerId === action.playerId || ann.markingPlayerId === action.playerId) return null;
            return ann;
          }
          // Detach snapped line endpoints from deleted player (freeze at last position)
          if (ann.type === 'passing-line' || ann.type === 'running-line' || ann.type === 'curved-run' || ann.type === 'dribble-line') {
            let updated = ann;
            if (ann.startPlayerId === action.playerId) {
              const deletedPlayer = state.players.find(p => p.id === action.playerId);
              updated = {
                ...updated,
                start: deletedPlayer ? { x: deletedPlayer.x, y: deletedPlayer.y } : ann.start,
                startPlayerId: undefined,
              };
            }
            if (ann.endPlayerId === action.playerId) {
              const deletedPlayer = state.players.find(p => p.id === action.playerId);
              updated = {
                ...updated,
                end: deletedPlayer ? { x: deletedPlayer.x, y: deletedPlayer.y } : ann.end,
                endPlayerId: undefined,
              };
            }
            return updated;
          }
          return ann;
        })
        .filter((ann): ann is Annotation => ann !== null);
      const remainingPlayers = state.players.filter(p => p.id !== action.playerId);
      return {
        ...state,
        ...withUndo(state),
        players: remainingPlayers,
        annotations: cleanedAnnotations,
        selectedPlayerId: state.selectedPlayerId === action.playerId ? null : state.selectedPlayerId,
        resolvedPossession: computePossession(remainingPlayers, state.ball, state.possession, state.resolvedPossession),
      };
    }

    case 'SELECT_PLAYER':
      return {
        ...state,
        selectedPlayerId: action.playerId,
        ballSelected: false,
        selectedAnnotationId: null,
      };

    case 'HOVER_PLAYER':
      return {
        ...state,
        hoveredPlayerId: action.playerId,
        hoveredNotchPlayerId: action.playerId !== state.hoveredNotchPlayerId ? null : state.hoveredNotchPlayerId,
        ballHovered: false,
        ballSelected: false,
      };

    case 'HOVER_NOTCH':
      return {
        ...state,
        hoveredNotchPlayerId: action.playerId,
      };

    case 'START_DRAG':
      return {
        ...state,
        ...withUndo(state),
        dragTarget: {
          type: 'player',
          playerId: action.playerId,
          offsetX: action.offsetX,
          offsetY: action.offsetY,
        },
        selectedPlayerId: action.playerId,
        ballSelected: false,
      };

    case 'START_FORMATION_MOVE':
      return {
        ...state,
        ...withUndo(state),
        dragTarget: {
          type: 'formation-move',
          team: action.team,
          anchorX: action.anchorX,
          anchorY: action.anchorY,
        },
        selectedPlayerId: null,
        ballSelected: false,
      };

    case 'SET_FORMATION_MOVE_TEAM':
      return { ...state, formationMoveTeam: action.team };

    case 'END_DRAG': {
      const wasBallDrag = state.dragTarget?.type === 'ball';
      const players = wasBallDrag && state.autoOrientToBall
        ? autoOrientPlayers(state.players, state.ball.x, state.ball.y, state.playerRadius)
        : state.players;
      const newState = { ...state, dragTarget: null, players };
      return {
        ...newState,
        resolvedPossession: computePossession(newState.players, newState.ball, newState.possession, state.resolvedPossession),
      };
    }

    // --- Ball actions ---

    case 'MOVE_BALL': {
      const clampedX = Math.max(0, Math.min(PITCH.length, action.x));
      const clampedY = Math.max(0, Math.min(PITCH.width, action.y));
      const dx = clampedX - state.ball.x;
      const dy = clampedY - state.ball.y;
      return {
        ...state,
        ball: {
          ...state.ball,
          x: clampedX,
          y: clampedY,
          rotationX: state.ball.rotationX + dx / state.ball.radius,
          rotationY: state.ball.rotationY + dy / state.ball.radius,
        },
      };
    }

    case 'SET_BALL_RADIUS': {
      const radius = Math.max(0.5, Math.min(2.5, action.radius));
      return { ...state, ball: { ...state.ball, radius } };
    }

    case 'START_DRAG_BALL':
      return {
        ...state,
        ...withUndo(state),
        dragTarget: { type: 'ball', offsetX: action.offsetX, offsetY: action.offsetY },
        ballSelected: true,
        selectedPlayerId: null,
      };

    case 'SELECT_BALL':
      return { ...state, ballSelected: true, selectedPlayerId: null, selectedAnnotationId: null };

    case 'HOVER_BALL':
      return { ...state, ballHovered: true, hoveredPlayerId: null, hoveredNotchPlayerId: null };

    // --- End ball actions ---

    case 'EDIT_PLAYER': {
      return {
        ...state,
        players: state.players.map(p => {
          if (p.id !== action.playerId) return p;
          return {
            ...p,
            ...(action.number !== undefined ? { number: action.number } : {}),
            ...(action.name !== undefined ? { name: action.name } : {}),
          };
        }),
      };
    }

    case 'START_EDITING':
      return { ...state, editingPlayerId: action.playerId, selectedPlayerId: action.playerId };

    case 'STOP_EDITING':
      return { ...state, editingPlayerId: null };

    case 'SET_MOUSE_WORLD':
      return { ...state, mouseWorldX: action.x, mouseWorldY: action.y };

    case 'SET_PLAYER_RADIUS': {
      const radius = Math.max(1.0, Math.min(2.5, action.radius));
      return { ...state, playerRadius: radius };
    }

    case 'ROTATE_PLAYER': {
      const normalized = ((action.facing % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const snapInterval = Math.PI / 8; // 22.5° — snaps to 16 directions
      const snapped = Math.round(normalized / snapInterval) * snapInterval;
      return {
        ...state,
        players: state.players.map(p =>
          p.id === action.playerId ? { ...p, facing: snapped } : p,
        ),
      };
    }

    case 'START_ROTATE':
      return {
        ...state,
        ...withUndo(state),
        dragTarget: {
          type: 'rotate',
          playerId: action.playerId,
          startAngle: action.startAngle,
          startFacing: action.startFacing,
        },
        selectedPlayerId: action.playerId,
        ballSelected: false,
      };

    case 'SET_POSSESSION':
      return {
        ...state,
        possession: action.possession,
        resolvedPossession: computePossession(state.players, state.ball, action.possession, state.resolvedPossession),
      };

    case 'SET_SHOW_ORIENTATION':
      return {
        ...state,
        showOrientation: action.show,
        // Cover shadow, FOV, and auto-orient require orientation — turn them off when orientation is disabled
        ...(action.show ? {} : { showCoverShadow: false, fovMode: 'off' as const, autoOrientToBall: false }),
      };

    case 'SET_SHOW_COVER_SHADOW':
      return { ...state, showCoverShadow: action.show };

    case 'SET_SHOW_STEP_NUMBERS':
      return { ...state, showStepNumbers: action.show };

    case 'SET_AUTO_ORIENT_TO_BALL': {
      if (!action.enabled) return { ...state, autoOrientToBall: false };
      // Immediately snap all off-ball players to face the ball
      return {
        ...state,
        autoOrientToBall: true,
        players: autoOrientPlayers(state.players, state.ball.x, state.ball.y, state.playerRadius),
      };
    }

    case 'SET_FOV_MODE':
      return { ...state, fovMode: action.mode };

    case 'SET_FOV_EXPANDED':
      return { ...state, fovExpanded: action.expanded };

    case 'SET_SHOW_PLAYER_NAMES':
      return action.team === 'A'
        ? { ...state, showPlayerNamesA: action.show }
        : { ...state, showPlayerNamesB: action.show };

    case 'SET_CMD_HELD':
      return { ...state, cmdHeld: action.held };

    case 'SET_SHIFT_HELD':
      return { ...state, shiftHeld: action.held };

    case 'SET_PENDING_DELETE_PLAYER':
      return { ...state, pendingDeletePlayerId: action.playerId };

    case 'SET_ACTIVE_BENCH':
      return { ...state, activeBench: action.bench };

    case 'ADD_SUBSTITUTE': {
      const key = action.team === 'A' ? 'substitutesA' : 'substitutesB';
      return { ...state, [key]: [...state[key], action.substitute] };
    }

    case 'REMOVE_SUBSTITUTE': {
      const key = action.team === 'A' ? 'substitutesA' : 'substitutesB';
      return { ...state, [key]: state[key].filter(s => s.id !== action.substituteId) };
    }

    case 'EDIT_SUBSTITUTE': {
      const key = action.team === 'A' ? 'substitutesA' : 'substitutesB';
      return {
        ...state,
        [key]: state[key].map(s => {
          if (s.id !== action.substituteId) return s;
          return {
            ...s,
            ...(action.number !== undefined ? { number: action.number } : {}),
            ...(action.name !== undefined ? { name: action.name } : {}),
          };
        }),
      };
    }

    case 'SUBSTITUTE_PLAYER': {
      const subsKey = action.team === 'A' ? 'substitutesA' : 'substitutesB';
      const sub = state[subsKey].find(s => s.id === action.substituteId);
      const player = state.players.find(p => p.id === action.playerId);
      if (!sub || !player) return state;

      const undo = withUndo(state);

      // Swap: sub goes on pitch at player's position, player goes to bench
      // If replacing a GK, the incoming player inherits the GK role
      const newPlayer: Player = {
        id: sub.id,
        team: player.team,
        number: sub.number,
        name: sub.name,
        x: player.x,
        y: player.y,
        facing: player.facing,
        ...(player.isGK ? { isGK: true } : {}),
      };

      const newSub: SubstitutePlayer = {
        id: player.id,
        team: player.team,
        number: player.number,
        name: player.name,
      };

      return {
        ...state,
        ...undo,
        players: state.players.map(p => (p.id === action.playerId ? newPlayer : p)),
        [subsKey]: state[subsKey].map(s => (s.id === action.substituteId ? newSub : s)),
        selectedPlayerId: null,
      };
    }

    case 'UNDO': {
      if (state.undoStack.length === 0) return state;
      const prev = state.undoStack[state.undoStack.length - 1];
      const currentSnapshot = { players: state.players, ball: state.ball, annotations: state.annotations, ghostPlayers: state.ghostPlayers, ghostAnnotationIds: state.ghostAnnotationIds, previewGhosts: state.previewGhosts };
      return {
        ...state,
        players: prev.players,
        ball: prev.ball,
        annotations: prev.annotations ?? [],
        ghostPlayers: prev.ghostPlayers ?? [],
        ghostAnnotationIds: prev.ghostAnnotationIds ?? [],
        previewGhosts: prev.previewGhosts ?? [],
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, currentSnapshot],
        resolvedPossession: computePossession(prev.players, prev.ball, state.possession, state.resolvedPossession),
      };
    }

    case 'REDO': {
      if (state.redoStack.length === 0) return state;
      const next = state.redoStack[state.redoStack.length - 1];
      const currentSnapshot = { players: state.players, ball: state.ball, annotations: state.annotations, ghostPlayers: state.ghostPlayers, ghostAnnotationIds: state.ghostAnnotationIds, previewGhosts: state.previewGhosts };
      return {
        ...state,
        players: next.players,
        ball: next.ball,
        annotations: next.annotations ?? [],
        ghostPlayers: next.ghostPlayers ?? [],
        ghostAnnotationIds: next.ghostAnnotationIds ?? [],
        previewGhosts: next.previewGhosts ?? [],
        undoStack: [...state.undoStack, currentSnapshot],
        resolvedPossession: computePossession(next.players, next.ball, state.possession, state.resolvedPossession),
        redoStack: state.redoStack.slice(0, -1),
      };
    }

    case 'RESET': {
      const resetFormationId = action.defaultFormationId || '4-4-2';
      return {
        ...initialState,
        teamAColor: state.teamAColor,
        teamBColor: state.teamBColor,
        teamAOutlineColor: state.teamAOutlineColor,
        teamBOutlineColor: state.teamBOutlineColor,
        clubIdentity: state.clubIdentity,
        themeMode: state.themeMode,
        teamAFormation: resetFormationId,
        players: createDefaultPlayers(initialState.teamADirection, resetFormationId),
        ball: { ...defaultBall },
        annotations: [],
        ghostPlayers: [],
        ghostAnnotationIds: [],
        previewGhosts: [],
      };
    }

    // --- Annotation / Drawing actions ---

    case 'SET_DRAW_SUB_TOOL':
      return { ...state, drawSubTool: action.subTool };

    case 'ADD_ANNOTATION': {
      const ann = action.annotation;
      // Create a preview ghost at the destination when a running-line or curved-run is drawn from a player
      let newPreviewGhosts = state.previewGhosts;
      if ((ann.type === 'running-line' || ann.type === 'curved-run' || ann.type === 'dribble-line') && ann.startPlayerId) {
        const srcPlayer = state.players.find(p => p.id === ann.startPlayerId);
        if (srcPlayer) {
          const dx = ann.end.x - ann.start.x;
          const dy = ann.end.y - ann.start.y;
          const facing = (dx === 0 && dy === 0) ? srcPlayer.facing : Math.atan2(dy, dx);
          const ghost: PreviewGhost = {
            playerId: srcPlayer.id,
            team: srcPlayer.team,
            number: srcPlayer.number,
            name: srcPlayer.name,
            x: ann.end.x,
            y: ann.end.y,
            facing,
            isGK: srcPlayer.isGK,
            sourceAnnotationId: ann.id,
          };
          // Allow multiple ghosts per player (chained runs/dribbles).
          // Only replace if re-adding the same annotation (e.g. after undo).
          newPreviewGhosts = [...state.previewGhosts.filter(g => g.sourceAnnotationId !== ann.id), ghost];
        }
      }
      return {
        ...state,
        ...withUndo(state),
        annotations: [...state.annotations, ann],
        previewGhosts: newPreviewGhosts,
      };
    }

    case 'DELETE_ANNOTATION': {
      // If deleting a ghost annotation, clean up the associated ghost player visual
      // but do NOT move the real player back. Use CMD+Z to undo the run itself.
      const deletedAnn = state.annotations.find(a => a.id === action.annotationId);
      const isGhostAnn = state.ghostAnnotationIds.includes(action.annotationId);
      const ghostPlayerIdToRemove = (isGhostAnn && deletedAnn && 'startPlayerId' in deletedAnn)
        ? (deletedAnn as { startPlayerId?: string }).startPlayerId
        : undefined;
      return {
        ...state,
        ...withUndo(state),
        annotations: state.annotations.filter(a => a.id !== action.annotationId),
        selectedAnnotationId: state.selectedAnnotationId === action.annotationId ? null : state.selectedAnnotationId,
        ghostAnnotationIds: state.ghostAnnotationIds.filter(id => id !== action.annotationId),
        ghostPlayers: ghostPlayerIdToRemove
          ? state.ghostPlayers.filter(g => g.playerId !== ghostPlayerIdToRemove)
          : state.ghostPlayers,
        previewGhosts: state.previewGhosts.filter(g => g.sourceAnnotationId !== action.annotationId),
      };
    }

    case 'CLEAR_ALL_ANNOTATIONS': {
      if (state.annotations.length === 0) return state;
      return {
        ...state,
        ...withUndo(state),
        annotations: [],
        selectedAnnotationId: null,
        editingAnnotationId: null,
        drawingInProgress: null,
        ghostAnnotationIds: [],
        ghostPlayers: [],
        previewGhosts: [],
      };
    }

    case 'MOVE_ANNOTATION': {
      const movedAnnotations = state.annotations.map(ann => {
        if (ann.id !== action.annotationId) return ann;
        switch (ann.type) {
          case 'text':
            return { ...ann, position: { x: ann.position.x + action.dx, y: ann.position.y + action.dy } };
          case 'passing-line':
          case 'running-line':
          case 'curved-run':
          case 'dribble-line': {
            // Fully player-anchored — don't move
            if (ann.startPlayerId && ann.endPlayerId) return ann;
            return {
              ...ann,
              start: ann.startPlayerId ? ann.start : { x: clampX(ann.start.x + action.dx), y: clampY(ann.start.y + action.dy) },
              end: ann.endPlayerId ? ann.end : { x: clampX(ann.end.x + action.dx), y: clampY(ann.end.y + action.dy) },
            };
          }
          case 'polygon':
            return {
              ...ann,
              points: ann.points.map(p => ({ x: clampX(p.x + action.dx), y: clampY(p.y + action.dy) })),
            };
          case 'ellipse':
            return {
              ...ann,
              center: { x: clampX(ann.center.x + action.dx), y: clampY(ann.center.y + action.dy) },
            };
          // player-polygon, player-line, and player-marking are anchored to players — don't move
          case 'player-marking':
          default:
            return ann;
        }
      });

      // Update preview ghosts: keep ghost position in sync with its source annotation endpoint
      const movedAnn = movedAnnotations.find(a => a.id === action.annotationId);
      let previewGhosts = state.previewGhosts;
      if (movedAnn && (movedAnn.type === 'running-line' || movedAnn.type === 'curved-run' || movedAnn.type === 'dribble-line') && !movedAnn.endPlayerId) {
        const endX = movedAnn.end.x;
        const endY = movedAnn.end.y;
        const dx = movedAnn.end.x - movedAnn.start.x;
        const dy = movedAnn.end.y - movedAnn.start.y;
        const facing = (dx === 0 && dy === 0) ? undefined : Math.atan2(dy, dx);
        previewGhosts = state.previewGhosts.map(g =>
          g.sourceAnnotationId === action.annotationId
            ? { ...g, x: endX, y: endY, ...(facing !== undefined ? { facing } : {}) }
            : g
        );
      }

      return { ...state, annotations: movedAnnotations, previewGhosts };
    }

    case 'SELECT_ANNOTATION':
      return {
        ...state,
        selectedAnnotationId: action.annotationId,
        selectedPlayerId: null,
        ballSelected: false,
      };

    case 'START_DRAG_ANNOTATION':
      return {
        ...state,
        ...withUndo(state),
        dragTarget: {
          type: 'annotation',
          annotationId: action.annotationId,
          offsetX: action.offsetX,
          offsetY: action.offsetY,
          initRefX: action.initRefX,
          initRefY: action.initRefY,
        },
        selectedAnnotationId: action.annotationId,
        selectedPlayerId: null,
        ballSelected: false,
      };

    case 'START_DRAWING':
      return { ...state, drawingInProgress: action.drawing };

    case 'UPDATE_DRAWING':
      return { ...state, drawingInProgress: action.drawing };

    case 'CANCEL_DRAWING':
      return { ...state, drawingInProgress: null };

    case 'START_EDITING_ANNOTATION':
      return { ...state, editingAnnotationId: action.annotationId, selectedAnnotationId: action.annotationId };

    case 'STOP_EDITING_ANNOTATION':
      return { ...state, editingAnnotationId: null };

    case 'EDIT_ANNOTATION':
      return {
        ...state,
        annotations: state.annotations.map(ann => {
          if (ann.id !== action.annotationId) return ann;
          return { ...ann, ...action.changes } as Annotation;
        }),
      };

    // --- Animation actions ---

    case 'ENTER_ANIMATION_MODE':
      return {
        ...state,
        animationMode: true,
        drawingInProgress: null,
        activeTool: state.activeTool === 'draw' || state.activeTool === 'delete' || state.activeTool === 'add-player' || state.activeTool === 'formation-move'
          ? 'select' as const
          : state.activeTool,
      };

    case 'EXIT_ANIMATION_MODE':
      return {
        ...state,
        animationMode: false,
        activeKeyframeIndex: null,
      };

    case 'CAPTURE_KEYFRAME': {
      const newKeyframe: Keyframe = {
        id: `kf-${Date.now()}`,
        players: structuredClone(state.players),
        ball: structuredClone(state.ball),
        annotations: structuredClone(state.annotations),
        durationMs: 1000,
      };

      const currentSeq = state.animationSequence;
      const updatedSequence: AnimationSequence = currentSeq
        ? {
            ...currentSeq,
            keyframes: [...currentSeq.keyframes, newKeyframe],
          }
        : {
            id: `seq-${Date.now()}`,
            name: 'Untitled Sequence',
            keyframes: [newKeyframe],
            speedMultiplier: 1,
          };

      return {
        ...state,
        animationSequence: updatedSequence,
        activeKeyframeIndex: updatedSequence.keyframes.length - 1,
      };
    }

    case 'UPDATE_KEYFRAME': {
      if (!state.animationSequence) return state;
      const kfs = state.animationSequence.keyframes;
      if (action.index < 0 || action.index >= kfs.length) return state;

      const updated = [...kfs];
      updated[action.index] = {
        ...updated[action.index],
        players: structuredClone(state.players),
        ball: structuredClone(state.ball),
        annotations: structuredClone(state.annotations),
      };

      return {
        ...state,
        animationSequence: {
          ...state.animationSequence,
          keyframes: updated,
        },
      };
    }

    case 'DELETE_KEYFRAME': {
      if (!state.animationSequence) return state;
      const kfs = state.animationSequence.keyframes;
      if (action.index < 0 || action.index >= kfs.length) return state;

      const remaining = kfs.filter((_, i) => i !== action.index);

      // If no keyframes left, clear the sequence
      if (remaining.length === 0) {
        return {
          ...state,
          animationSequence: null,
          activeKeyframeIndex: null,
        };
      }

      // Adjust activeKeyframeIndex
      let newActiveIdx = state.activeKeyframeIndex;
      if (newActiveIdx !== null) {
        if (newActiveIdx === action.index) {
          newActiveIdx = Math.min(action.index, remaining.length - 1);
        } else if (newActiveIdx > action.index) {
          newActiveIdx = newActiveIdx - 1;
        }
      }

      return {
        ...state,
        animationSequence: {
          ...state.animationSequence,
          keyframes: remaining,
        },
        activeKeyframeIndex: newActiveIdx,
      };
    }

    case 'REORDER_KEYFRAME': {
      if (!state.animationSequence) return state;
      const kfs = [...state.animationSequence.keyframes];
      if (
        action.from < 0 || action.from >= kfs.length ||
        action.to < 0 || action.to >= kfs.length
      ) return state;

      const [moved] = kfs.splice(action.from, 1);
      kfs.splice(action.to, 0, moved);

      // Update activeKeyframeIndex to follow the active keyframe
      let newIdx = state.activeKeyframeIndex;
      if (newIdx !== null) {
        if (newIdx === action.from) {
          newIdx = action.to;
        } else if (action.from < newIdx && action.to >= newIdx) {
          newIdx = newIdx - 1;
        } else if (action.from > newIdx && action.to <= newIdx) {
          newIdx = newIdx + 1;
        }
      }

      return {
        ...state,
        animationSequence: {
          ...state.animationSequence,
          keyframes: kfs,
        },
        activeKeyframeIndex: newIdx,
      };
    }

    case 'SELECT_KEYFRAME': {
      if (!state.animationSequence) return state;
      const kfs = state.animationSequence.keyframes;
      if (action.index < 0 || action.index >= kfs.length) return state;

      const keyframe = kfs[action.index];
      return {
        ...state,
        ...withUndo(state),
        players: structuredClone(keyframe.players),
        ball: structuredClone(keyframe.ball),
        annotations: structuredClone(keyframe.annotations),
        activeKeyframeIndex: action.index,
        resolvedPossession: computePossession(keyframe.players, keyframe.ball, state.possession, state.resolvedPossession),
      };
    }

    case 'SET_KEYFRAME_DURATION': {
      if (!state.animationSequence) return state;
      const kfs = state.animationSequence.keyframes;
      if (action.index < 0 || action.index >= kfs.length) return state;

      const updated = [...kfs];
      updated[action.index] = {
        ...updated[action.index],
        durationMs: Math.max(100, action.durationMs),
      };

      return {
        ...state,
        animationSequence: {
          ...state.animationSequence,
          keyframes: updated,
        },
      };
    }

    case 'SET_KEYFRAME_LABEL': {
      if (!state.animationSequence) return state;
      const kfs = state.animationSequence.keyframes;
      if (action.index < 0 || action.index >= kfs.length) return state;

      const updated = [...kfs];
      updated[action.index] = {
        ...updated[action.index],
        label: action.label || undefined,
      };

      return {
        ...state,
        animationSequence: {
          ...state.animationSequence,
          keyframes: updated,
        },
      };
    }

    case 'SET_ANIMATION_SPEED': {
      if (!state.animationSequence) return state;
      return {
        ...state,
        animationSequence: {
          ...state.animationSequence,
          speedMultiplier: Math.max(0.25, Math.min(4, action.speedMultiplier)),
        },
      };
    }

    case 'SET_ANIMATION_NAME': {
      if (!state.animationSequence) return state;
      return {
        ...state,
        animationSequence: {
          ...state.animationSequence,
          name: action.name,
        },
      };
    }

    case 'CLEAR_ANIMATION':
      return {
        ...state,
        animationSequence: null,
        activeKeyframeIndex: null,
      };

    case 'LOAD_ANIMATION': {
      const seq = action.sequence;
      // Load the first keyframe onto the canvas
      const firstKf = seq.keyframes[0];
      if (firstKf) {
        return {
          ...state,
          ...withUndo(state),
          animationSequence: seq,
          activeKeyframeIndex: 0,
          players: structuredClone(firstKf.players),
          ball: structuredClone(firstKf.ball),
          annotations: structuredClone(firstKf.annotations),
          resolvedPossession: computePossession(firstKf.players, firstKf.ball, state.possession, state.resolvedPossession),
        };
      }
      return {
        ...state,
        animationSequence: seq,
        activeKeyframeIndex: null,
      };
    }

    case 'LOAD_SCENE': {
      const d = action.data;
      const newPlayers = (d.players ?? []).map(p => ({
        ...p,
        facing: p.facing ?? defaultFacing(p.team, d.teamADirection),
        ...(p.isGK === undefined && p.number === 1 ? { isGK: true } : {}),
      }));
      const newBall = { ...initialState.ball, ...d.ball };
      return {
        ...state,
        ...withUndo(state),
        players: newPlayers,
        ball: newBall,
        annotations: d.annotations ?? [],
        teamAName: d.teamAName,
        teamBName: d.teamBName,
        teamAColor: d.teamAColor,
        teamBColor: d.teamBColor,
        teamAOutlineColor: d.teamAOutlineColor ?? '#000000',
        teamBOutlineColor: d.teamBOutlineColor ?? '#000000',
        teamADirection: d.teamADirection,
        teamAFormation: d.teamAFormation,
        teamBFormation: d.teamBFormation,
        playerRadius: d.playerRadius,
        pitchSettings: { ...initialState.pitchSettings, ...d.pitchSettings },
        showOrientation: d.showOrientation,
        showCoverShadow: d.showCoverShadow,
        fovMode: d.fovMode ?? 'off',
        fovExpanded: d.fovExpanded ?? false,
        autoOrientToBall: d.autoOrientToBall ?? false,
        possession: d.possession,
        substitutesA: d.substitutesA ?? [],
        substitutesB: d.substitutesB ?? [],
        animationMode: d.animationMode ?? false,
        animationSequence: d.animationSequence ?? null,
        activeKeyframeIndex: d.animationSequence?.keyframes?.length ? 0 : null,
        resolvedPossession: computePossession(newPlayers, newBall, d.possession, state.resolvedPossession),
        ghostPlayers: [],
        ghostAnnotationIds: [],
        previewGhosts: d.previewGhosts ?? [],
        // Clear transient state
        selectedPlayerId: null,
        hoveredPlayerId: null,
        hoveredNotchPlayerId: null,
        editingPlayerId: null,
        dragTarget: null,
        ballSelected: false,
        ballHovered: false,
        selectedAnnotationId: null,
        editingAnnotationId: null,
        drawingInProgress: null,
      };
    }

    // --- Club identity actions ---

    case 'SET_CLUB_IDENTITY':
      return {
        ...state,
        clubIdentity: { ...state.clubIdentity, ...action.identity },
      };

    case 'CLEAR_CLUB_IDENTITY':
      return {
        ...state,
        clubIdentity: initialState.clubIdentity,
      };

    case 'SET_THEME_MODE':
      return { ...state, themeMode: action.mode };

    case 'SET_SHOW_LOGO_ON_MARKERS':
      return { ...state, showLogoOnMarkers: action.show };

    case 'SET_TEAM_LOGO_URL':
      return { ...state, teamALogoUrl: action.url };

    // --- Per-player run animation (ghost) actions ---

    case 'EXECUTE_RUN': {
      const undo = withUndo(state);

      const animType = action.animationType ?? 'run';

      // For pass: player stays put. For run/dribble: player moves to endpoint.
      const players = animType === 'pass'
        ? state.players
        : state.players.map(p =>
            p.id === action.playerId
              ? { ...p, x: action.x, y: action.y, facing: action.facing }
              : p
          );

      // For pass/dribble: move ball to endpoint
      let ball = state.ball;
      if ((animType === 'pass' || animType === 'dribble') && action.ballX != null && action.ballY != null) {
        const dx = action.ballX - state.ball.x;
        const dy = action.ballY - state.ball.y;
        ball = {
          ...state.ball,
          x: action.ballX,
          y: action.ballY,
          rotationX: state.ball.rotationX + dx / state.ball.radius,
          rotationY: state.ball.rotationY + dy / state.ball.radius,
        };
      }

      // Auto-orient off-ball players toward the new ball position
      const finalPlayers = state.autoOrientToBall && (animType === 'pass' || animType === 'dribble')
        ? autoOrientPlayers(players, ball.x, ball.y, state.playerRadius)
        : players;

      // Ghost player: keep only the latest ghost per player (replaces previous)
      // Ghost annotation IDs: accumulate — don't remove previous ones.
      // Cleanup of old ghosts happens in CLEAR_PLAYER_GHOSTS / RESET_RUN.
      // Preview ghost: only remove when the player physically moves (run/dribble).
      // A pass from a player doesn't move them, so their preview ghost (showing a
      // future run destination) must stay visible until that run actually completes.
      const removePreviewGhost = animType !== 'pass';
      return {
        ...state,
        ...undo,
        players: finalPlayers,
        ball,
        ghostPlayers: [
          ...state.ghostPlayers.filter(g => g.playerId !== action.playerId),
          { ...action.ghost, createdAt: 0 }, // 0 = fade not started; stamped when queue empties
        ],
        ghostAnnotationIds: state.ghostAnnotationIds.includes(action.annotationId)
          ? state.ghostAnnotationIds
          : [...state.ghostAnnotationIds, action.annotationId],
        previewGhosts: removePreviewGhost
          ? state.previewGhosts.filter(g => g.sourceAnnotationId !== action.annotationId)
          : state.previewGhosts,
      };
    }

    case 'CLEAR_PLAYER_GHOSTS': {
      // Find ghost annotation IDs associated with this player
      const ghostAnnIdsToRemove = state.ghostAnnotationIds.filter(aid =>
        state.annotations.some(a => a.id === aid &&
          ('startPlayerId' in a) && (a as { startPlayerId?: string }).startPlayerId === action.playerId)
      );
      return {
        ...state,
        ghostPlayers: state.ghostPlayers.filter(g => g.playerId !== action.playerId),
        ghostAnnotationIds: state.ghostAnnotationIds.filter(id => !ghostAnnIdsToRemove.includes(id)),
        // Also remove the ghost annotations themselves — they represent the previous run
        // and would otherwise render as stale artifacts from the player's new position.
        annotations: state.annotations.filter(a => !ghostAnnIdsToRemove.includes(a.id)),
        // Keep preview ghosts — they represent future positions the user drew,
        // not artifacts from completed animations. They should persist until
        // their corresponding run/dribble actually executes.
      };
    }

    case 'RESET_RUN': {
      // Move the player back to the ghost position, clear ghost & ghost annotation status.
      // Used to allow re-triggering the run animation (Space pressed again).
      // No undo push — the subsequent EXECUTE_RUN will push undo.
      const ghost = state.ghostPlayers.find(g => g.playerId === action.playerId);
      if (!ghost) return state;

      // Find ghost annotation IDs for this player
      const resetGhostAnnIds = state.ghostAnnotationIds.filter(aid =>
        state.annotations.some(a => a.id === aid &&
          ('startPlayerId' in a) && (a as { startPlayerId?: string }).startPlayerId === action.playerId)
      );

      return {
        ...state,
        players: state.players.map(p =>
          p.id === action.playerId
            ? { ...p, x: ghost.x, y: ghost.y, facing: ghost.facing }
            : p
        ),
        ghostPlayers: state.ghostPlayers.filter(g => g.playerId !== action.playerId),
        ghostAnnotationIds: state.ghostAnnotationIds.filter(id => !resetGhostAnnIds.includes(id)),
      };
    }

    case 'STAMP_GHOST_FADE_START':
      return {
        ...state,
        ghostPlayers: state.ghostPlayers.map(g =>
          g.createdAt === 0 ? { ...g, createdAt: action.time } : g
        ),
      };

    default:
      return state;
  }
}
