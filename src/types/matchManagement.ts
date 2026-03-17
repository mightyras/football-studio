import type { PositionRole, SubstitutePlayer } from './index';

// ── Substitution Rule Modes ──

export type SubstitutionRuleMode = 'free' | 'fifa-standard';

export type MatchPeriod = 'first-half' | 'second-half' | 'extra-time-1' | 'extra-time-2';

// ── Match Events (own team only) ──

export type MatchSubstitutionEvent = {
  type: 'substitution';
  id: string;
  minute: number;
  playerOutId: string;
  playerInId: string;
  assignedRole?: PositionRole; // if set, incoming player gets this role instead of inheriting from outgoing
};

export type MatchPositionChangeEvent = {
  type: 'position-change';
  id: string;
  minute: number;
  playerId: string;
  fromRole: PositionRole;
  toRole: PositionRole;
};

export type MatchEvent = MatchSubstitutionEvent | MatchPositionChangeEvent;

// ── Player Role Assignment (snapshot of a player's state at a point in time) ──

export type PlayerRoleAssignment = {
  playerId: string;
  number: number;
  name: string;
  role: PositionRole;
  isGK?: boolean;
};

// ── Match Plan ──

export type MatchPlan = {
  id: string;
  ruleMode: SubstitutionRuleMode;
  hasExtraTime: boolean;          // false = 90 min, true = 120 min (2x15 ET)
  halftimeMinute: number;         // default 45
  startingLineup: PlayerRoleAssignment[];   // own team (Team A) only
  startingBench: SubstitutePlayer[];        // own team bench
  events: MatchEvent[];           // sorted by minute
};

// ── Computed State at a Point in Time (derived, not stored) ──

export type MatchMinuteState = {
  minute: number;
  onPitch: PlayerRoleAssignment[];
  bench: SubstitutePlayer[];
  minutesPlayed: Record<string, number>;
  positionHistory: Record<string, Array<{ role: PositionRole; from: number; to: number }>>;
  subsUsed: number;
  windowsUsed: number;
  subsRemaining: number;
  windowsRemaining: number;
  currentPeriod: MatchPeriod;
};
