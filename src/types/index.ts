export type Player = {
  id: string;
  team: 'A' | 'B';
  number: number;
  name: string;
  x: number;
  y: number;
  facing: number; // radians, world-space. 0 = toward +X, PI = toward -X
  isGK?: boolean;
};

export type PositionRole = 'GK' | 'CB' | 'LCB' | 'RCB' | 'FB' | 'WB' | 'DM' | 'CM' | 'OM' | 'CF' | 'LW' | 'RW';

export type FormationPosition = {
  x: number;
  y: number;
  role: PositionRole;
  defaultNumber: number;
};

export type Formation = {
  id: string;
  name: string;
  positions: FormationPosition[];
};

export type BallState = {
  x: number;
  y: number;
  radius: number;
  rotationX: number;
  rotationY: number;
};

export type ToolType = 'select' | 'add-player' | 'delete' | 'draw' | 'formation-move';

export type AttackDirection = 'up' | 'down';

export type ZoneOverlay = 'none' | 'corridors' | 'zones18' | 'thirds' | 'phases';

export type ZoneDirection = 'bottom-to-top' | 'top-to-bottom';

export type PitchSettings = {
  grassColor: string;
  stripeColor: string;
  stripesEnabled: boolean;
  stripeOpacity: number;
  stadiumEnabled: boolean;
  zoneOverlay: ZoneOverlay;
  zoneDirection: ZoneDirection;
  zoneLineColor: string;
  zoneLineOpacity: number;
  zoneLineWidth: number;
  zoneTintOpacity: number;
};

export type SubstitutePlayer = {
  id: string;
  team: 'A' | 'B';
  number: number;
  name: string;
};

// ── Ghost / Run Animation types ──

/** Ghost left behind at origin when a player runs along a line */
export type GhostPlayer = {
  playerId: string;    // original player ID (for color/team lookup)
  team: 'A' | 'B';
  number: number;
  name: string;
  x: number;
  y: number;
  facing: number;
  isGK?: boolean;
  createdAt: number;   // performance.now() timestamp; 0 = fade not started yet
};

/** Preview ghost at run/curved-run destination, shown immediately when annotation is drawn.
 *  Acts as a snap target so passes can target a player's future position. */
export type PreviewGhost = {
  playerId: string;       // same as the player who will run there
  team: 'A' | 'B';
  number: number;
  name: string;
  x: number;              // destination position
  y: number;
  facing: number;
  isGK?: boolean;
  sourceAnnotationId: string;  // annotation that created this ghost
};

/** Transient animation state — lives in a mutable ref, NOT in AppState */
export type PlayerRunAnimation = {
  playerId: string;
  annotationId: string;
  startPos: WorldPoint;
  endPos: WorldPoint;
  controlPoint?: WorldPoint;   // quadratic bezier CP for curved-run
  startTime: number;           // performance.now()
  durationMs: number;          // ~1000ms
  animationType: 'run' | 'pass' | 'dribble';  // what kind of animation
  endPlayerId?: string;        // target player for pass animations
  isOneTouch?: boolean;        // one-touch bounce pass — no ease-in, ball leaves instantly
};

/** A queued animation waiting to start (no startTime yet) */
export type QueuedAnimation = {
  annotationId: string;
  playerId: string;
  endPos: WorldPoint;
  controlPoint?: WorldPoint;
  curveDirection?: 'left' | 'right';  // for curved-run: compute control point at start time
  durationMs: number;
  animationType: 'run' | 'pass' | 'dribble';
  endPlayerId?: string;
  isOneTouch?: boolean;        // one-touch bounce pass — no ease-in, ball leaves instantly
  step: number;                // animation step — same step = simultaneous
};

/** Visual overlay data passed through render pipeline during run animation */
export type RunAnimationOverlay = {
  annotationId: string;       // which annotation is being animated
  playerId: string;
  progress: number;           // eased 0..1 — how far along the path
  ghostPlayer: GhostPlayer;   // transient ghost to render during animation
  ballPos?: WorldPoint;       // ball position during pass/dribble animations
  animationType: 'run' | 'pass' | 'dribble';
};

/** Transient goal celebration state — lives in React state / mutable ref, NOT in AppState */
export type GoalCelebration = {
  startTime: number;           // performance.now()
  impactPoint: WorldPoint;     // where ball hit the net (world coords)
  side: 'left' | 'right';     // which goal
  durationMs: number;          // ~1500ms for net ripple
  scorerTeam: 'A' | 'B';
  scorerNumber: number;
  scorerName: string;
  teamName: string;
  teamColor: string;
};

// ── Annotation / Drawing types ──

export type WorldPoint = { x: number; y: number };

export type DrawSubTool =
  | 'text'
  | 'passing-line'
  | 'running-line'
  | 'curved-run'
  | 'dribble-line'
  | 'polygon'
  | 'player-polygon'
  | 'player-line'
  | 'ellipse'
  | 'player-marking';

export type TextAnnotation = {
  id: string;
  type: 'text';
  text: string;
  position: WorldPoint;
  fontSize: number;
  color: string;
};

export type PassingLineAnnotation = {
  id: string;
  type: 'passing-line';
  start: WorldPoint;
  end: WorldPoint;
  startPlayerId?: string;
  endPlayerId?: string;
  color: string;
  animStep?: number; // animation step (1-based), same step = simultaneous
};

export type RunningLineAnnotation = {
  id: string;
  type: 'running-line';
  start: WorldPoint;
  end: WorldPoint;
  startPlayerId?: string;
  endPlayerId?: string;
  color: string;
  animStep?: number; // animation step (1-based), same step = simultaneous
};

export type CurvedRunAnnotation = {
  id: string;
  type: 'curved-run';
  start: WorldPoint;
  end: WorldPoint;
  startPlayerId?: string;
  endPlayerId?: string;
  color: string;
  animStep?: number; // animation step (1-based), same step = simultaneous
  curveDirection?: 'left' | 'right'; // default 'left' when undefined
};

export type DribbleLineAnnotation = {
  id: string;
  type: 'dribble-line';
  start: WorldPoint;
  end: WorldPoint;
  startPlayerId?: string;
  endPlayerId?: string;
  color: string;
  animStep?: number; // animation step (1-based), same step = simultaneous
};

export type PolygonAnnotation = {
  id: string;
  type: 'polygon';
  points: WorldPoint[];
  fillColor: string;
  fillOpacity: number;
  strokeColor: string;
};

export type PlayerPolygonAnnotation = {
  id: string;
  type: 'player-polygon';
  playerIds: string[];
  fillColor: string;
  fillOpacity: number;
  strokeColor: string;
};

export type PlayerLineAnnotation = {
  id: string;
  type: 'player-line';
  playerIds: string[];
  color: string;
  lineWidth: number;
};

export type EllipseAnnotation = {
  id: string;
  type: 'ellipse';
  center: WorldPoint;
  radiusX: number;
  radiusY: number;
  fillColor: string;
  fillOpacity: number;
  strokeColor: string;
};

export type PlayerMarkingAnnotation = {
  id: string;
  type: 'player-marking';
  markedPlayerId: string;   // player being marked (clicked first)
  markingPlayerId: string;  // player doing the marking (clicked second)
  fillColor: string;
  fillOpacity: number;      // e.g. 0.08
  strokeColor: string;
};

export type Annotation =
  | TextAnnotation
  | PassingLineAnnotation
  | RunningLineAnnotation
  | CurvedRunAnnotation
  | DribbleLineAnnotation
  | PolygonAnnotation
  | PlayerPolygonAnnotation
  | PlayerLineAnnotation
  | EllipseAnnotation
  | PlayerMarkingAnnotation;

export type DrawingInProgress =
  | { type: 'line'; subTool: 'passing-line' | 'running-line' | 'curved-run' | 'dribble-line'; start: WorldPoint; startPlayerId?: string; startFromGhost?: boolean; curveDirection?: 'left' | 'right' }
  | { type: 'polygon'; points: WorldPoint[] }
  | { type: 'player-polygon'; playerIds: string[] }
  | { type: 'player-line'; playerIds: string[] }
  | { type: 'ellipse'; center: WorldPoint }
  | { type: 'player-marking'; markedPlayerId: string };

export type PanelTab = 'formations' | 'settings' | 'scenes' | 'help';

export type ZoomPreset = 'full' | 'top-half' | 'bottom-half';

export type ZoomState = {
  zoom: number;        // 1.0 = fit-all, 2.0 = 2x magnification, etc.
  focusX: number;      // world X of viewport center
  focusY: number;      // world Y of viewport center
};

export type PitchRotation = 0 | 1 | 2 | 3; // quarter-turn index: 0=0°, 1=90°CW, 2=180°, 3=270°CW

export type PitchTransform = {
  worldToScreen(wx: number, wy: number): { x: number; y: number };
  screenToWorld(sx: number, sy: number): { x: number; y: number };
  scale: number;
  offsetX: number;
  offsetY: number;
  zoom: number;        // effective zoom multiplier (1.0 = fit-all)
  rotation: number;    // rotation in radians (0, π/2, π, 3π/2)
};

export type DragTarget =
  | { type: 'player'; playerId: string; offsetX: number; offsetY: number }
  | { type: 'ball'; offsetX: number; offsetY: number }
  | { type: 'rotate'; playerId: string; startAngle: number; startFacing: number }
  | { type: 'annotation'; annotationId: string; offsetX: number; offsetY: number; initRefX: number; initRefY: number }
  | { type: 'formation-move'; team: 'A' | 'B'; anchorX: number; anchorY: number };

// ── Animation types ──

export type Keyframe = {
  id: string;
  players: Player[];
  ball: BallState;
  annotations: Annotation[];
  durationMs: number;  // transition duration TO this keyframe (first = hold time)
  label?: string;
};

export type AnimationSequence = {
  id: string;
  name: string;
  keyframes: Keyframe[];
  speedMultiplier: number; // 0.25–4.0
};

// ── Club identity types ──

export type ClubIdentity = {
  logoDataUrl: string | null;     // base64 data URL, max 128×128px
  primaryColor: string | null;    // hex, replaces default accent when set
  secondaryColor: string | null;  // hex, replaces default accent hover when set
  clubName: string | null;        // optional, for future use
};

// ── Saved scene types ──

export type SceneData = {
  players: Player[];
  ball: BallState;
  annotations: Annotation[];
  teamAName: string;
  teamBName: string;
  teamAColor: string;
  teamBColor: string;
  teamAOutlineColor: string;
  teamBOutlineColor: string;
  teamADirection: AttackDirection;
  teamAFormation: string | null;
  teamBFormation: string | null;
  playerRadius: number;
  pitchSettings: PitchSettings;
  showOrientation: boolean;
  showCoverShadow: boolean;
  fovMode: 'off' | 'A' | 'B' | 'both';
  fovExpanded: boolean;
  autoOrientToBall: boolean;
  possession: 'A' | 'B' | 'auto';
  substitutesA: SubstitutePlayer[];
  substitutesB: SubstitutePlayer[];
  animationMode: boolean;
  animationSequence: AnimationSequence | null;
};

export type SavedScene = {
  id: string;
  name: string;
  savedAt: number;
  thumbnail: string;
  data: SceneData;
};

export type AppState = {
  players: Player[];
  ball: BallState;
  selectedPlayerId: string | null;
  hoveredPlayerId: string | null;
  hoveredNotchPlayerId: string | null;
  editingPlayerId: string | null;
  dragTarget: DragTarget | null;
  ballSelected: boolean;
  ballHovered: boolean;
  activeTool: ToolType;
  activeTeam: 'A' | 'B';
  teamAName: string;
  teamBName: string;
  teamAColor: string;
  teamBColor: string;
  teamAOutlineColor: string;
  teamBOutlineColor: string;
  teamADirection: AttackDirection;
  teamAFormation: string | null;
  teamBFormation: string | null;
  showPlayerNamesA: boolean;
  showPlayerNamesB: boolean;
  playerRadius: number;
  possession: 'A' | 'B' | 'auto';
  resolvedPossession: 'A' | 'B';
  showOrientation: boolean;
  showCoverShadow: boolean;
  fovMode: 'off' | 'A' | 'B' | 'both';
  fovExpanded: boolean;
  autoOrientToBall: boolean;
  pitchSettings: PitchSettings;
  cmdHeld: boolean;
  shiftHeld: boolean;
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  editingAnnotationId: string | null;
  drawSubTool: DrawSubTool;
  drawingInProgress: DrawingInProgress | null;
  undoStack: Array<{ players: Player[]; ball: BallState; annotations?: Annotation[]; ghostPlayers?: GhostPlayer[]; ghostAnnotationIds?: string[]; previewGhosts?: PreviewGhost[] }>;
  redoStack: Array<{ players: Player[]; ball: BallState; annotations?: Annotation[]; ghostPlayers?: GhostPlayer[]; ghostAnnotationIds?: string[]; previewGhosts?: PreviewGhost[] }>;
  mouseWorldX: number | null;
  mouseWorldY: number | null;
  substitutesA: SubstitutePlayer[];
  substitutesB: SubstitutePlayer[];
  activeBench: 'A' | 'B' | null;
  animationMode: boolean;
  animationSequence: AnimationSequence | null;
  activeKeyframeIndex: number | null;
  showStepNumbers: boolean;
  clubIdentity: ClubIdentity;
  ghostPlayers: GhostPlayer[];
  ghostAnnotationIds: string[];
  previewGhosts: PreviewGhost[];
  pendingDeletePlayerId: string | null;
  formationMoveTeam: 'A' | 'B' | null;
};
