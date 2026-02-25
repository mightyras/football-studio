import type { Annotation, AnimationSequence, BallState, Keyframe, Player, WorldPoint } from '../types';

export type LineAnnotation = Extract<Annotation, { type: 'passing-line' | 'running-line' | 'curved-run' | 'dribble-line' }>;

/**
 * Compute step assignments for a set of line annotations using tactical dependency rules.
 * Returns an array of step numbers (1-based) corresponding to each annotation index.
 * Returns null if auto-ordering should be skipped (different manual steps, ≤1 annotation, cycle).
 *
 * Rules:
 * 1. Pass from player + run/curved-run from same player → pass before run ("pass and go")
 * 2. Run from player + pass ending at that player → run before pass ("move to receive")
 * 3. Pass ending at player + dribble from that player → pass before dribble ("receive and advance")
 * 4. Pass ending at player + pass starting from that player → first pass before second ("one-touch relay")
 */
export function computeStepOrder(annotations: LineAnnotation[]): number[] | null {
  if (annotations.length <= 1) return null;

  // Only auto-order when all share the same step (user hasn't manually ordered)
  const steps = new Set(annotations.map(a => a.animStep ?? 1));
  if (steps.size > 1) return null;

  const n = annotations.length;
  const edges: number[][] = Array.from({ length: n }, () => []);
  const inDegree = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const a = annotations[i];
      const b = annotations[j];

      // Rule 1: Pass from X + Run/CurvedRun from X → pass before run
      if (
        a.type === 'passing-line' &&
        (b.type === 'running-line' || b.type === 'curved-run') &&
        a.startPlayerId && a.startPlayerId === b.startPlayerId
      ) {
        edges[i].push(j);
        inDegree[j]++;
      }

      // Rule 2: Run/CurvedRun from X + Pass ending at X → run before pass
      if (
        (a.type === 'running-line' || a.type === 'curved-run') &&
        b.type === 'passing-line' &&
        a.startPlayerId && a.startPlayerId === b.endPlayerId
      ) {
        edges[i].push(j);
        inDegree[j]++;
      }

      // Rule 3: Pass ending at X + Dribble from X → pass before dribble
      if (
        a.type === 'passing-line' &&
        b.type === 'dribble-line' &&
        a.endPlayerId && a.endPlayerId === b.startPlayerId
      ) {
        edges[i].push(j);
        inDegree[j]++;
      }

      // Rule 4: Pass ending at X + Pass starting from X → first pass before second
      if (
        a.type === 'passing-line' &&
        b.type === 'passing-line' &&
        a.endPlayerId && a.endPlayerId === b.startPlayerId
      ) {
        edges[i].push(j);
        inDegree[j]++;
      }
    }
  }

  // Topological sort (Kahn's algorithm)
  const stepAssignment = new Array(n).fill(1);
  const queue: number[] = [];

  for (let i = 0; i < n; i++) {
    if (inDegree[i] === 0) queue.push(i);
  }

  let processed = 0;
  while (queue.length > 0) {
    const nextQueue: number[] = [];
    for (const idx of queue) {
      processed++;
      for (const dep of edges[idx]) {
        stepAssignment[dep] = Math.max(stepAssignment[dep], stepAssignment[idx] + 1);
        inDegree[dep]--;
        if (inDegree[dep] === 0) nextQueue.push(dep);
      }
    }
    queue.length = 0;
    queue.push(...nextQueue);
  }

  // Cycle detected → fall back
  if (processed < n) return null;

  return stepAssignment;
}

/** Duration for one-touch bounce passes (ms). Slightly shorter than normal to keep tempo up. */
export const ONE_TOUCH_DURATION_MS = 600;

/** Default animation durations per type (ms). */
export const ANIM_DURATION_MS = {
  pass: 1000,
  loftedPass: 1500, // longer flight time — includes bounces after landing
  run: 1100,        // slightly slower than a pass
  dribble: 1400,    // noticeably slower — running with the ball
} as const;

/** Delay before a pass starts when targeting a same-step runner (ms).
 *  Gives the runner a head start so the ball isn't kicked into empty space. */
export const PASS_LEAD_DELAY_MS = 250;

/**
 * Detect which annotations are "one-touch" passes.
 * A one-touch pass is a passing-line whose startPlayerId matches the endPlayerId
 * of another passing-line (i.e., the player receives and immediately redirects).
 *
 * Returns a Set of annotation indices that are one-touch.
 */
export function computeOneTouchIndices(annotations: LineAnnotation[]): Set<number> {
  const result = new Set<number>();
  for (let j = 0; j < annotations.length; j++) {
    const b = annotations[j];
    if (b.type !== 'passing-line') continue;
    for (let i = 0; i < annotations.length; i++) {
      if (i === j) continue;
      const a = annotations[i];
      // Rule 4 pattern: pass A ends at player X, pass B starts from player X
      if (
        a.type === 'passing-line' &&
        a.endPlayerId && a.endPlayerId === b.startPlayerId
      ) {
        result.add(j);
        break; // annotation j is one-touch, no need to check more
      }
    }
  }
  return result;
}

/**
 * Auto-assign animation steps based on tactical dependency rules.
 * Wrapper around computeStepOrder that returns modified annotations.
 */
function autoAssignSteps(annotations: LineAnnotation[]): LineAnnotation[] {
  if (annotations.length <= 1) return annotations;

  const stepAssignment = computeStepOrder(annotations);
  if (!stepAssignment) return annotations;

  return annotations.map((ann, i) => ({
    ...ann,
    animStep: stepAssignment[i],
  }));
}

/**
 * Build an AnimationSequence from line-type annotations on the canvas.
 *
 * Annotations are grouped by `animStep` (default 1). Within the same step,
 * all movements execute simultaneously. Steps execute sequentially.
 *
 * When all annotations share the same step, auto-ordering is applied based
 * on tactical dependency rules (pass-and-go, move-to-receive, etc.).
 *
 * Semantic rules:
 * - passing-line: ball moves from start → end (players don't move)
 * - running-line: startPlayer moves to end position (without ball)
 * - dribble-line: startPlayer AND ball move to end position
 *
 * Returns null if no applicable line annotations exist.
 */
export function buildSequenceFromAnnotations(
  players: Player[],
  ball: BallState,
  annotations: Annotation[],
  durationMsPerStep: number,
): AnimationSequence | null {
  // Filter to line-type annotations only
  const rawLineAnnotations = annotations.filter(
    (a): a is LineAnnotation =>
      a.type === 'passing-line' || a.type === 'running-line' || a.type === 'curved-run' || a.type === 'dribble-line',
  );

  if (rawLineAnnotations.length === 0) return null;

  // Auto-assign steps based on tactical dependency rules (only when all share same step)
  const lineAnnotations = autoAssignSteps(rawLineAnnotations);

  // Detect one-touch passes for per-step duration
  const oneTouchIndices = computeOneTouchIndices(lineAnnotations);

  // Group by animStep (default 1) and build per-step one-touch map
  const stepMap = new Map<number, typeof lineAnnotations>();
  // A step is "one-touch" only if ALL annotations in it are one-touch passes
  const stepOneTouchMap = new Map<number, boolean>();
  for (let i = 0; i < lineAnnotations.length; i++) {
    const ann = lineAnnotations[i];
    const step = ann.animStep ?? 1;
    const group = stepMap.get(step);
    if (group) {
      group.push(ann);
    } else {
      stepMap.set(step, [ann]);
    }
    const isOT = oneTouchIndices.has(i);
    const existing = stepOneTouchMap.get(step);
    stepOneTouchMap.set(step, existing === undefined ? isOT : (existing && isOT));
  }

  // Sort step numbers ascending
  const sortedSteps = Array.from(stepMap.keys()).sort((a, b) => a - b);

  // Build keyframes: start with initial state, then one keyframe per step
  const keyframes: Keyframe[] = [];

  // Keyframe 0 = initial state
  let currentPlayers = structuredClone(players);
  let currentBall = structuredClone(ball);

  keyframes.push({
    id: `kf-anim-0`,
    players: structuredClone(currentPlayers),
    ball: structuredClone(currentBall),
    annotations: [], // strip annotations — they're instructions, not visuals
    durationMs: durationMsPerStep,
  });

  let anyMovement = false;

  for (const stepNum of sortedSteps) {
    const stepAnnotations = stepMap.get(stepNum)!;

    // Clone current state as the starting point for computing this step's end
    const endPlayers = structuredClone(currentPlayers);
    const endBall = structuredClone(currentBall);

    // Track which players moved (for facing computation)
    const playerMoves = new Map<string, { fromX: number; fromY: number; toX: number; toY: number }>();

    for (const ann of stepAnnotations) {
      // Resolve start and end positions
      const resolvedStart = resolvePosition(ann.start, ann.startPlayerId, currentPlayers);
      const resolvedEnd = resolvePosition(ann.end, ann.endPlayerId, currentPlayers);

      switch (ann.type) {
        case 'passing-line': {
          // Ball moves from start to end; players don't move
          endBall.x = resolvedEnd.x;
          endBall.y = resolvedEnd.y;
          anyMovement = true;
          break;
        }
        case 'running-line':
        case 'curved-run': {
          // Player at startPlayerId moves to end position, ball stays
          if (ann.startPlayerId) {
            const playerIdx = endPlayers.findIndex(p => p.id === ann.startPlayerId);
            if (playerIdx >= 0) {
              const fromX = endPlayers[playerIdx].x;
              const fromY = endPlayers[playerIdx].y;
              endPlayers[playerIdx] = {
                ...endPlayers[playerIdx],
                x: resolvedEnd.x,
                y: resolvedEnd.y,
              };
              playerMoves.set(ann.startPlayerId!, { fromX, fromY, toX: resolvedEnd.x, toY: resolvedEnd.y });
              anyMovement = true;
            }
          }
          break;
        }
        case 'dribble-line': {
          // Player AND ball move to end position
          if (ann.startPlayerId) {
            const playerIdx = endPlayers.findIndex(p => p.id === ann.startPlayerId);
            if (playerIdx >= 0) {
              const fromX = endPlayers[playerIdx].x;
              const fromY = endPlayers[playerIdx].y;
              endPlayers[playerIdx] = {
                ...endPlayers[playerIdx],
                x: resolvedEnd.x,
                y: resolvedEnd.y,
              };
              playerMoves.set(ann.startPlayerId!, { fromX, fromY, toX: resolvedEnd.x, toY: resolvedEnd.y });
            }
          }
          endBall.x = resolvedEnd.x;
          endBall.y = resolvedEnd.y;
          anyMovement = true;
          break;
        }
      }
    }

    // Update facing for moved players
    for (const [playerId, move] of playerMoves) {
      const dx = move.toX - move.fromX;
      const dy = move.toY - move.fromY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0.5) { // Only update facing if meaningful movement
        const playerIdx = endPlayers.findIndex(p => p.id === playerId);
        if (playerIdx >= 0) {
          // facing convention: 0 = toward +X (down the pitch)
          endPlayers[playerIdx] = {
            ...endPlayers[playerIdx],
            facing: Math.atan2(dy, dx),
          };
        }
      }
    }

    // Compute ball rotation from movement
    const ballDx = endBall.x - currentBall.x;
    const ballDy = endBall.y - currentBall.y;
    endBall.rotationX = currentBall.rotationX + ballDx / currentBall.radius;
    endBall.rotationY = currentBall.rotationY + ballDy / currentBall.radius;

    // Create keyframe for this step's end state
    const isOneTouchStep = stepOneTouchMap.get(stepNum) ?? false;
    keyframes.push({
      id: `kf-anim-${stepNum}`,
      players: structuredClone(endPlayers),
      ball: structuredClone(endBall),
      annotations: [],
      durationMs: isOneTouchStep ? ONE_TOUCH_DURATION_MS : durationMsPerStep,
    });

    // Carry forward: next step starts from this step's end state
    currentPlayers = endPlayers;
    currentBall = endBall;
  }

  if (!anyMovement) return null;

  return {
    id: `seq-anim-${Date.now()}`,
    name: 'Line Animation',
    keyframes,
    speedMultiplier: 1,
  };
}

/**
 * Resolve a position: if a playerId is given, use that player's current position.
 * Otherwise fall back to the stored WorldPoint.
 */
function resolvePosition(
  point: WorldPoint,
  playerId: string | undefined,
  players: Player[],
): WorldPoint {
  if (playerId) {
    const player = players.find(p => p.id === playerId);
    if (player) {
      return { x: player.x, y: player.y };
    }
  }
  return point;
}
