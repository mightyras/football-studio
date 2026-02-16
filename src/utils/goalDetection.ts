import { PITCH } from '../constants/pitch';

export type GoalDetectionResult = {
  inGoal: boolean;
  side: 'left' | 'right' | null;
};

/**
 * Check if a world point is inside either goal.
 *
 * Left goal:  x in [-goalDepth, 0],  y in [goalY, goalY + goalWidth]
 * Right goal: x in [PITCH.length, PITCH.length + goalDepth], y in [goalY, goalY + goalWidth]
 *
 * A small tolerance (0.5 world units) is added beyond the goal line
 * so passes ending right at the line still count.
 */
export function isPointInGoal(x: number, y: number): GoalDetectionResult {
  const goalY = (PITCH.width - PITCH.goalWidth) / 2;
  const goalYEnd = goalY + PITCH.goalWidth;

  // Y must be between the posts
  if (y < goalY || y > goalYEnd) {
    return { inGoal: false, side: null };
  }

  // Left goal (with 0.5 tolerance past the goal line)
  if (x <= 0.5 && x >= -(PITCH.goalDepth + 0.5)) {
    return { inGoal: true, side: 'left' };
  }

  // Right goal (with 0.5 tolerance past the goal line)
  if (x >= PITCH.length - 0.5 && x <= PITCH.length + PITCH.goalDepth + 0.5) {
    return { inGoal: true, side: 'right' };
  }

  return { inGoal: false, side: null };
}
