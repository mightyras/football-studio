import type { MatchPlan, MatchMinuteState } from '../types/matchManagement';
import { ROLE_LABELS } from '../types';
import { computeMatchStateAtMinute, getTotalMinutes } from './matchComputation';

/**
 * Generate a plain text summary of the match plan.
 */
export function generateTextExport(
  plan: MatchPlan,
  teamName: string,
  oppositionName: string,
  formationName: string,
): string {
  const totalMinutes = getTotalMinutes(plan);
  const finalState = computeMatchStateAtMinute(plan, totalMinutes);
  const lines: string[] = [];

  lines.push(`Match Plan — ${teamName} vs ${oppositionName}`);
  lines.push(`Rule Mode: ${plan.ruleMode === 'fifa-standard' ? 'FIFA Standard' : 'Free Subs'} | Formation: ${formationName} | Duration: ${totalMinutes} min${plan.hasExtraTime ? ' (Extra Time)' : ''}`);
  lines.push('');

  // Starting XI
  lines.push('Starting XI:');
  for (const p of plan.startingLineup) {
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
): Promise<Blob> {
  const totalMinutes = getTotalMinutes(plan);
  const finalState = computeMatchStateAtMinute(plan, totalMinutes);
  const subEvents = plan.events.filter(e => e.type === 'substitution');

  // Pre-calculate required canvas height based on content
  const TITLE_BLOCK = 66;        // title + subtitle + gap
  const TIMELINE_BLOCK = 44;     // timeline bar + gap below
  const SECTION_GAP = 10;        // gap before each section header
  const HEADER_HEIGHT = 18;      // section header text line
  const PLAYER_ROW = 20;         // per-player row
  const SUB_ROW = 18;            // per-substitution row
  const BOTTOM_PADDING = 30;

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
  const W = 800;
  const H = Math.max(600, calcH);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, W, H);

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(`${teamName} vs ${oppositionName}`, 24, 36);

  ctx.fillStyle = '#888';
  ctx.font = '12px system-ui, sans-serif';
  const ruleText = plan.ruleMode === 'fifa-standard' ? 'FIFA Standard' : 'Free Subs';
  ctx.fillText(`${ruleText} | ${formationName} | ${totalMinutes} min${plan.hasExtraTime ? ' (Extra Time)' : ''}`, 24, 56);

  // Timeline bar
  const tlX = 24;
  const tlY = 76;
  const tlW = W - 48;
  const tlH = 20;
  ctx.fillStyle = '#2a2a4e';
  roundRect(ctx, tlX, tlY, tlW, tlH, 4);
  ctx.fill();

  // Halftime marker
  const htPct = plan.halftimeMinute / totalMinutes;
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tlX + tlW * htPct, tlY);
  ctx.lineTo(tlX + tlW * htPct, tlY + tlH);
  ctx.stroke();

  // Sub event markers (subEvents already computed above for height calc)
  for (const e of subEvents) {
    const pct = e.minute / totalMinutes;
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(tlX + tlW * pct, tlY + tlH / 2, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Starting XI
  let y = 120;
  ctx.fillStyle = '#aaa';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('STARTING XI', 24, y);
  y += 18;

  ctx.font = '12px system-ui, sans-serif';
  const sortedStarters = [...plan.startingLineup].sort((a, b) =>
    (finalState.minutesPlayed[b.playerId] ?? 0) - (finalState.minutesPlayed[a.playerId] ?? 0),
  );
  for (const p of sortedStarters) {
    const role = ROLE_LABELS[p.role] || p.role;
    const mins = finalState.minutesPlayed[p.playerId] ?? 0;

    // Role badge
    ctx.fillStyle = teamColor;
    roundRect(ctx, 24, y - 10, 30, 14, 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.fillText(role, 28, y);

    // Player info
    ctx.fillStyle = '#ddd';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(`#${p.number} ${p.name || 'Player'}`, 60, y);

    // Minutes bar
    const barX = 300;
    const barW = 200;
    const barH = 8;
    ctx.fillStyle = '#2a2a4e';
    roundRect(ctx, barX, y - 6, barW, barH, 3);
    ctx.fill();
    const fillW = totalMinutes > 0 ? (mins / totalMinutes) * barW : 0;
    ctx.fillStyle = '#22c55e';
    roundRect(ctx, barX, y - 6, fillW, barH, 3);
    ctx.fill();

    // Minutes text
    ctx.fillStyle = '#888';
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText(`${mins}'`, barX + barW + 8, y);

    // Position history
    const positions = finalState.positionHistory[p.playerId] ?? [];
    const roles = [...new Set(positions.map(h => ROLE_LABELS[h.role] || h.role))].join('/');
    if (roles) {
      ctx.fillText(roles, barX + barW + 40, y);
    }

    y += 20;
  }

  // Bench
  y += 10;
  ctx.fillStyle = '#aaa';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('BENCH', 24, y);
  y += 18;

  ctx.font = '12px system-ui, sans-serif';
  const sortedBench = [...plan.startingBench].sort((a, b) =>
    (finalState.minutesPlayed[b.id] ?? 0) - (finalState.minutesPlayed[a.id] ?? 0),
  );
  for (const s of sortedBench) {
    const mins = finalState.minutesPlayed[s.id] ?? 0;
    ctx.fillStyle = mins > 0 ? '#ddd' : '#666';
    ctx.fillText(`#${s.number} ${s.name || 'Player'}`, 60, y);

    if (mins > 0) {
      const barX = 300;
      const barW = 200;
      const barH = 8;
      ctx.fillStyle = '#2a2a4e';
      roundRect(ctx, barX, y - 6, barW, barH, 3);
      ctx.fill();
      const fillW = totalMinutes > 0 ? (mins / totalMinutes) * barW : 0;
      ctx.fillStyle = '#22c55e';
      roundRect(ctx, barX, y - 6, fillW, barH, 3);
      ctx.fill();
      ctx.fillStyle = '#888';
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillText(`${mins}'`, barX + barW + 8, y);

      // Position history for bench players who played
      const positions = finalState.positionHistory[s.id] ?? [];
      const roles = [...new Set(positions.map(h => ROLE_LABELS[h.role] || h.role))].join('/');
      if (roles) {
        ctx.fillText(roles, barX + barW + 40, y);
      }

      ctx.font = '12px system-ui, sans-serif';
    }
    y += 20;
  }

  // Substitutions
  if (subEvents.length > 0) {
    y += 10;
    ctx.fillStyle = '#aaa';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText('SUBSTITUTIONS', 24, y);
    y += 18;

    ctx.font = '12px system-ui, sans-serif';
    for (const e of subEvents) {
      if (e.type !== 'substitution') continue;
      const inP = findPlayerName(plan, e.playerInId);
      const outP = findPlayerName(plan, e.playerOutId);

      ctx.fillStyle = '#888';
      ctx.fillText(`${e.minute}'`, 24, y);
      ctx.fillStyle = '#22c55e';
      ctx.fillText('IN', 60, y);
      ctx.fillStyle = '#ddd';
      ctx.fillText(`#${inP.number} ${inP.name}`, 82, y);
      ctx.fillStyle = '#ef4444';
      ctx.fillText('OUT', 250, y);
      ctx.fillStyle = '#ddd';
      ctx.fillText(`#${outP.number} ${outP.name}`, 280, y);
      y += 18;
    }
  }

  // Branding footer
  ctx.fillStyle = '#555';
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillText('Football Tactics Studio — football-tactics-studio.com', 24, H - 12);

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
