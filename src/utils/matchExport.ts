import type { MatchPlan } from '../types/matchManagement';
import type { FormationPosition } from '../types';
import { ROLE_LABELS } from '../types';
import { computeMatchStateAtMinute, getTotalMinutes } from './matchComputation';
import { sortByFormationPosition } from './formationMapping';

/**
 * Generate a plain text summary of the match plan.
 */
export function generateTextExport(
  plan: MatchPlan,
  teamName: string,
  oppositionName: string,
  formationName: string,
  formationPositions: FormationPosition[] = [],
): string {
  const totalMinutes = getTotalMinutes(plan);
  const finalState = computeMatchStateAtMinute(plan, totalMinutes);
  const lines: string[] = [];

  lines.push(`Match Plan — ${teamName} vs ${oppositionName}`);
  lines.push(`Rule Mode: ${plan.ruleMode === 'fifa-standard' ? 'FIFA Standard' : 'Free Subs'} | Formation: ${formationName} | Duration: ${totalMinutes} min${plan.hasExtraTime ? ' (Extra Time)' : ''}`);
  lines.push('');

  // Starting XI (sorted by formation position: GK → back → mid → fwd, L→R)
  const sortedLineup = sortByFormationPosition(plan.startingLineup, formationPositions);
  lines.push('Starting XI:');
  for (const p of sortedLineup) {
    const role = ROLE_LABELS[p.role] || p.role;
    lines.push(`  #${String(p.number).padStart(2)}  ${role.padEnd(4)} ${p.name || 'Player'}`);
  }
  lines.push('');

  // Bench
  lines.push('Bench:');
  if (plan.startingBench.length === 0) {
    lines.push('  (none)');
  } else {
    for (const s of plan.startingBench) {
      lines.push(`  #${String(s.number).padStart(2)}  ${s.name || 'Player'}`);
    }
  }
  lines.push('');

  // Substitutions
  const subEvents = plan.events.filter(e => e.type === 'substitution');
  if (subEvents.length > 0) {
    lines.push('Substitutions:');
    const windowTracker = new Set<number>();
    for (const e of subEvents) {
      if (e.type !== 'substitution') continue;
      const inPlayer = findPlayerName(plan, e.playerInId);
      const outPlayer = findPlayerName(plan, e.playerOutId);

      let windowNote = '';
      if (plan.ruleMode === 'fifa-standard') {
        const isHalftime = e.minute === plan.halftimeMinute || e.minute === 90;
        if (!isHalftime && !windowTracker.has(e.minute)) {
          windowTracker.add(e.minute);
        }
        const windowNum = isHalftime ? 'HT' : `Window ${windowTracker.size}/${plan.hasExtraTime ? 4 : 3}`;
        windowNote = `  (${windowNum})`;
      }

      lines.push(`  ${String(e.minute).padStart(3)}'  IN #${inPlayer.number} ${inPlayer.name}  OUT #${outPlayer.number} ${outPlayer.name}${windowNote}`);
    }
    lines.push('');
  }

  // Playing time (sorted by minutes, highest to lowest)
  lines.push('Playing Time:');
  const allPlayers = [
    ...plan.startingLineup.map(p => ({ id: p.playerId, number: p.number, name: p.name })),
    ...plan.startingBench.map(s => ({ id: s.id, number: s.number, name: s.name })),
  ]
    .map(p => ({ ...p, mins: finalState.minutesPlayed[p.id] ?? 0 }))
    .sort((a, b) => b.mins - a.mins);
  for (const p of allPlayers) {
    const positions = finalState.positionHistory[p.id] ?? [];
    const roles = [...new Set(positions.map(h => ROLE_LABELS[h.role] || h.role))].join('/');
    lines.push(`  #${String(p.number).padStart(2)}  ${(p.name || 'Player').padEnd(18)} ${String(p.mins).padStart(3)} min  (${roles || '-'})`);
  }

  return lines.join('\n');
}

/**
 * Generate a PNG image of the match plan summary.
 * Returns a Blob.
 */
export function generatePngExport(
  plan: MatchPlan,
  teamName: string,
  oppositionName: string,
  teamColor: string,
  formationName: string,
  formationPositions: FormationPosition[] = [],
): Promise<Blob> {
  const totalMinutes = getTotalMinutes(plan);
  const finalState = computeMatchStateAtMinute(plan, totalMinutes);
  const subEvents = plan.events.filter(e => e.type === 'substitution');

  // Pre-calculate required canvas height based on content (2x scale for crisp rendering)
  const TITLE_BLOCK = 132;       // title + subtitle + gap
  const TIMELINE_BLOCK = 88;     // timeline bar + gap below
  const SECTION_GAP = 20;        // gap before each section header
  const HEADER_HEIGHT = 36;      // section header text line
  const PLAYER_ROW = 40;         // per-player row
  const SUB_ROW = 36;            // per-substitution row
  const BOTTOM_PADDING = 60;

  let calcH = TITLE_BLOCK + TIMELINE_BLOCK;
  // Starting XI
  calcH += SECTION_GAP + HEADER_HEIGHT + plan.startingLineup.length * PLAYER_ROW;
  // Bench
  calcH += SECTION_GAP + HEADER_HEIGHT + plan.startingBench.length * PLAYER_ROW;
  // Substitutions
  if (subEvents.length > 0) {
    calcH += SECTION_GAP + HEADER_HEIGHT + subEvents.length * SUB_ROW;
  }
  calcH += BOTTOM_PADDING;

  const canvas = document.createElement('canvas');
  const W = 1600;
  const H = Math.max(1200, calcH);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, W, H);

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.fillText(`${teamName} vs ${oppositionName}`, 48, 72);

  ctx.fillStyle = '#888';
  ctx.font = '24px system-ui, sans-serif';
  const ruleText = plan.ruleMode === 'fifa-standard' ? 'FIFA Standard' : 'Free Subs';
  ctx.fillText(`${ruleText} | ${formationName} | ${totalMinutes} min${plan.hasExtraTime ? ' (Extra Time)' : ''}`, 48, 112);

  // Timeline bar
  const tlX = 48;
  const tlY = 152;
  const tlW = W - 96;
  const tlH = 40;
  ctx.fillStyle = '#2a2a4e';
  roundRect(ctx, tlX, tlY, tlW, tlH, 8);
  ctx.fill();

  // Halftime marker
  const htPct = plan.halftimeMinute / totalMinutes;
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(tlX + tlW * htPct, tlY);
  ctx.lineTo(tlX + tlW * htPct, tlY + tlH);
  ctx.stroke();

  // Sub event markers
  for (const e of subEvents) {
    const pct = e.minute / totalMinutes;
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(tlX + tlW * pct, tlY + tlH / 2, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  // Starting XI
  let y = 240;
  ctx.fillStyle = '#aaa';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('STARTING XI', 48, y);
  y += 36;

  ctx.font = '24px system-ui, sans-serif';
  const sortedStarters = sortByFormationPosition([...plan.startingLineup], formationPositions);
  for (const p of sortedStarters) {
    const role = ROLE_LABELS[p.role] || p.role;
    const mins = finalState.minutesPlayed[p.playerId] ?? 0;

    // Role badge
    ctx.fillStyle = teamColor;
    roundRect(ctx, 48, y - 20, 60, 28, 4);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(role, 56, y);

    // Player info
    ctx.fillStyle = '#ddd';
    ctx.font = '24px system-ui, sans-serif';
    ctx.fillText(`#${p.number} ${p.name || 'Player'}`, 120, y);

    // Minutes bar
    const barX = 600;
    const barW = 400;
    const barH = 16;
    ctx.fillStyle = '#2a2a4e';
    roundRect(ctx, barX, y - 12, barW, barH, 6);
    ctx.fill();
    const fillW = totalMinutes > 0 ? (mins / totalMinutes) * barW : 0;
    ctx.fillStyle = '#22c55e';
    roundRect(ctx, barX, y - 12, fillW, barH, 6);
    ctx.fill();

    // Minutes text
    ctx.fillStyle = '#888';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText(`${mins}'`, barX + barW + 16, y);

    // Position history
    const positions = finalState.positionHistory[p.playerId] ?? [];
    const roles = [...new Set(positions.map(h => ROLE_LABELS[h.role] || h.role))].join('/');
    if (roles) {
      ctx.fillText(roles, barX + barW + 80, y);
    }

    y += 40;
  }

  // Bench
  y += 20;
  ctx.fillStyle = '#aaa';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('BENCH', 48, y);
  y += 36;

  ctx.font = '24px system-ui, sans-serif';
  const sortedBench = [...plan.startingBench].sort((a, b) =>
    (finalState.minutesPlayed[b.id] ?? 0) - (finalState.minutesPlayed[a.id] ?? 0),
  );
  for (const s of sortedBench) {
    const mins = finalState.minutesPlayed[s.id] ?? 0;
    ctx.fillStyle = mins > 0 ? '#ddd' : '#666';
    ctx.fillText(`#${s.number} ${s.name || 'Player'}`, 120, y);

    if (mins > 0) {
      const barX = 600;
      const barW = 400;
      const barH = 16;
      ctx.fillStyle = '#2a2a4e';
      roundRect(ctx, barX, y - 12, barW, barH, 6);
      ctx.fill();
      const fillW = totalMinutes > 0 ? (mins / totalMinutes) * barW : 0;
      ctx.fillStyle = '#22c55e';
      roundRect(ctx, barX, y - 12, fillW, barH, 6);
      ctx.fill();
      ctx.fillStyle = '#888';
      ctx.font = '20px system-ui, sans-serif';
      ctx.fillText(`${mins}'`, barX + barW + 16, y);

      // Position history for bench players who played
      const positions = finalState.positionHistory[s.id] ?? [];
      const roles = [...new Set(positions.map(h => ROLE_LABELS[h.role] || h.role))].join('/');
      if (roles) {
        ctx.fillText(roles, barX + barW + 80, y);
      }

      ctx.font = '24px system-ui, sans-serif';
    }
    y += 40;
  }

  // Substitutions
  if (subEvents.length > 0) {
    y += 20;
    ctx.fillStyle = '#aaa';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('SUBSTITUTIONS', 48, y);
    y += 36;

    ctx.font = '24px system-ui, sans-serif';
    for (const e of subEvents) {
      if (e.type !== 'substitution') continue;
      const inP = findPlayerName(plan, e.playerInId);
      const outP = findPlayerName(plan, e.playerOutId);

      ctx.fillStyle = '#888';
      ctx.fillText(`${e.minute}'`, 48, y);
      ctx.fillStyle = '#22c55e';
      ctx.fillText('IN', 120, y);
      ctx.fillStyle = '#ddd';
      ctx.fillText(`#${inP.number} ${inP.name}`, 164, y);
      ctx.fillStyle = '#ef4444';
      ctx.fillText('OUT', 500, y);
      ctx.fillStyle = '#ddd';
      ctx.fillText(`#${outP.number} ${outP.name}`, 560, y);
      y += 36;
    }
  }

  // Branding footer
  ctx.fillStyle = '#555';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('Football Tactics Studio — football-tactics-studio.com', 48, H - 24);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Canvas export failed'))),
      'image/png',
    );
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function findPlayerName(
  plan: MatchPlan,
  playerId: string,
): { number: number; name: string } {
  const fromLineup = plan.startingLineup.find(p => p.playerId === playerId);
  if (fromLineup) return { number: fromLineup.number, name: fromLineup.name };
  const fromBench = plan.startingBench.find(s => s.id === playerId);
  if (fromBench) return { number: fromBench.number, name: fromBench.name };
  return { number: 0, name: '?' };
}
