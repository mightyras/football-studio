import type { SubstitutePlayer } from '../types';
import type {
  MatchPlan,
  MatchMinuteState,
  MatchPeriod,
  MatchSubstitutionEvent,
  PlayerRoleAssignment,
} from '../types/matchManagement';

/**
 * Determine which match period a given minute falls into.
 */
export function getMatchPeriod(minute: number, plan: MatchPlan): MatchPeriod {
  if (minute <= plan.halftimeMinute) return 'first-half';
  if (minute <= 90) return 'second-half';
  if (!plan.hasExtraTime) return 'second-half';
  if (minute <= 105) return 'extra-time-1';
  return 'extra-time-2';
}

/**
 * Get the total match duration in minutes.
 */
export function getTotalMinutes(plan: MatchPlan): number {
  return plan.hasExtraTime ? 120 : 90;
}

/**
 * Count how many substitution windows have been used (excluding halftime & ET breaks).
 * A window = a distinct minute where at least one substitution occurred.
 * Subs at halftimeMinute (45) or at minute 90 (break before ET) don't count as windows.
 */
export function countWindowsUsed(
  events: MatchPlan['events'],
  halftimeMinute: number,
): number {
  const subMinutes = new Set<number>();
  for (const e of events) {
    if (e.type !== 'substitution') continue;
    // Halftime and ET break subs are free windows
    if (e.minute === halftimeMinute || e.minute === 90) continue;
    subMinutes.add(e.minute);
  }
  return subMinutes.size;
}

/**
 * Count total substitutions made.
 */
export function countSubsUsed(events: MatchPlan['events']): number {
  return events.filter(e => e.type === 'substitution').length;
}

/**
 * Get the max allowed subs and windows based on rule mode and extra time.
 */
function getLimits(plan: MatchPlan): { maxSubs: number; maxWindows: number } {
  if (plan.ruleMode === 'free') {
    return { maxSubs: Infinity, maxWindows: Infinity };
  }
  // FIFA standard: 5 subs in 3 windows, +1 sub and +1 window in extra time
  const maxSubs = plan.hasExtraTime ? 6 : 5;
  const maxWindows = plan.hasExtraTime ? 4 : 3;
  return { maxSubs, maxWindows };
}

/**
 * Validate whether a substitution can be made at a given minute.
 */
export function validateSubstitution(
  plan: MatchPlan,
  minute: number,
): { allowed: boolean; reason?: string } {
  if (plan.ruleMode === 'free') return { allowed: true };

  const subsUsed = countSubsUsed(plan.events);
  const windowsUsed = countWindowsUsed(plan.events, plan.halftimeMinute);
  const { maxSubs, maxWindows } = getLimits(plan);

  if (subsUsed >= maxSubs) {
    return { allowed: false, reason: `All ${maxSubs} substitutions have been used` };
  }

  // Check if this minute is a free window (halftime or ET break)
  const isFreeWindow = minute === plan.halftimeMinute || minute === 90;

  // Check if there's already a sub at this minute (same window, no extra window cost)
  const existingSubAtMinute = plan.events.some(
    e => e.type === 'substitution' && e.minute === minute,
  );

  if (!isFreeWindow && !existingSubAtMinute && windowsUsed >= maxWindows) {
    return {
      allowed: false,
      reason: `All ${maxWindows} substitution windows have been used. You can still make subs at halftime${plan.hasExtraTime ? ' or before extra time' : ''}, or at a minute where you already have a sub planned.`,
    };
  }

  return { allowed: true };
}

/**
 * Compute the full match state at a given minute.
 * Applies all events up to and including the given minute.
 */
export function computeMatchStateAtMinute(
  plan: MatchPlan,
  minute: number,
): MatchMinuteState {
  // Start with initial lineup
  const onPitch = structuredClone(plan.startingLineup);
  const bench = structuredClone(plan.startingBench);

  // Track position history: playerId -> array of { role, from, to }
  const positionHistory: Record<string, Array<{ role: string; from: number; to: number }>> = {};
  // Initialize position history for starters
  for (const p of plan.startingLineup) {
    positionHistory[p.playerId] = [{ role: p.role, from: 0, to: minute }];
  }

  // Track when each player was on the pitch: playerId -> array of [startMinute, endMinute]
  const pitchTime: Record<string, Array<[number, number]>> = {};
  for (const p of plan.startingLineup) {
    pitchTime[p.playerId] = [[0, minute]];
  }
  for (const s of plan.startingBench) {
    pitchTime[s.id] = [];
  }

  // Apply events in order up to the target minute
  const eventsUpTo = plan.events.filter(e => e.minute <= minute);

  for (const event of eventsUpTo) {
    if (event.type === 'substitution') {
      const subEvent = event as MatchSubstitutionEvent;
      const outIdx = onPitch.findIndex(p => p.playerId === subEvent.playerOutId);
      const inIdx = bench.findIndex(s => s.id === subEvent.playerInId);
      if (outIdx === -1 || inIdx === -1) continue;

      const outPlayer = onPitch[outIdx];
      const inSub = bench[inIdx];

      // Close the outgoing player's pitch time and position history
      if (pitchTime[outPlayer.playerId]?.length) {
        const last = pitchTime[outPlayer.playerId][pitchTime[outPlayer.playerId].length - 1];
        last[1] = event.minute;
      }
      if (positionHistory[outPlayer.playerId]?.length) {
        const last = positionHistory[outPlayer.playerId][positionHistory[outPlayer.playerId].length - 1];
        last.to = event.minute;
      }

      // Create incoming player's role assignment
      // Use assignedRole if the sub specifies a direct role (e.g., bench → LB),
      // otherwise inherit the outgoing player's role
      const incomingRole = subEvent.assignedRole ?? outPlayer.role;
      const inPlayer: PlayerRoleAssignment = {
        playerId: inSub.id,
        number: inSub.number,
        name: inSub.name,
        role: incomingRole,
        isGK: incomingRole === 'GK' ? true : undefined,
      };

      // Create outgoing player as bench sub
      const outSub: SubstitutePlayer = {
        id: outPlayer.playerId,
        team: 'A',
        number: outPlayer.number,
        name: outPlayer.name,
      };

      // Swap
      onPitch[outIdx] = inPlayer;
      bench[inIdx] = outSub;

      // Start tracking for incoming player
      pitchTime[inSub.id] = pitchTime[inSub.id] || [];
      pitchTime[inSub.id].push([event.minute, minute]);
      positionHistory[inSub.id] = positionHistory[inSub.id] || [];
      positionHistory[inSub.id].push({ role: incomingRole, from: event.minute, to: minute });
    } else if (event.type === 'position-change') {
      const player = onPitch.find(p => p.playerId === event.playerId);
      if (!player) continue;

      const history = positionHistory[event.playerId];
      const lastEntry = history?.length ? history[history.length - 1] : null;

      // If the player's current position started at this SAME minute (e.g., subbed in
      // and immediately position-changed), merge instead of creating a phantom position
      if (lastEntry && lastEntry.from === event.minute) {
        // Overwrite the phantom role — player goes straight to the new role
        lastEntry.role = event.toRole;
        lastEntry.to = minute;
      } else {
        // Normal case: close previous position and start new one
        if (lastEntry) {
          lastEntry.to = event.minute;
        }
        positionHistory[event.playerId] = history || [];
        positionHistory[event.playerId].push({ role: event.toRole, from: event.minute, to: minute });
      }

      // Update role
      player.role = event.toRole;
      player.isGK = event.toRole === 'GK' ? true : undefined;
    }
  }

  // Calculate minutes played
  const minutesPlayed: Record<string, number> = {};
  for (const [playerId, intervals] of Object.entries(pitchTime)) {
    let total = 0;
    for (const [start, end] of intervals) {
      total += Math.min(end, minute) - start;
    }
    minutesPlayed[playerId] = Math.max(0, total);
  }

  // Count subs/windows up to this minute (not total across entire match)
  const subsUsed = countSubsUsed(eventsUpTo);
  const windowsUsed = countWindowsUsed(eventsUpTo, plan.halftimeMinute);
  const { maxSubs, maxWindows } = getLimits(plan);

  return {
    minute,
    onPitch,
    bench,
    minutesPlayed,
    positionHistory: positionHistory as MatchMinuteState['positionHistory'],
    subsUsed,
    windowsUsed,
    subsRemaining: Math.max(0, maxSubs - subsUsed),
    windowsRemaining: Math.max(0, maxWindows - windowsUsed),
    currentPeriod: getMatchPeriod(minute, plan),
  };
}
