import type { Formation, FormationPosition } from '../types';

function pos(x: number, y: number, role: FormationPosition['role'], defaultNumber: number): FormationPosition {
  return { x, y, role, defaultNumber };
}

// x = depth (0 = own goal, 1 = opponent goal). Range ~0.12 – 0.82 to use the half well.
// y = width (0 = left sideline, 1 = right sideline).
// Standard numbering: #2=RB (right), #3=LB (left), #7=RW (right), #11=LW (left)

export const FORMATIONS: Formation[] = [
  // ── 4-3-3 flat ──
  {
    id: '4-3-3-flat',
    name: '4-3-3 flat',
    positions: [
      pos(0.18, 0.15, 'FB', 3),   // left FB
      pos(0.12, 0.38, 'CB', 5),
      pos(0.12, 0.62, 'CB', 4),
      pos(0.18, 0.85, 'FB', 2),   // right FB
      pos(0.48, 0.25, 'CM', 8),
      pos(0.48, 0.50, 'CM', 6),
      pos(0.48, 0.75, 'CM', 10),
      pos(0.80, 0.15, 'LW', 11),  // left winger
      pos(0.80, 0.50, 'CF', 9),
      pos(0.80, 0.85, 'RW', 7),   // right winger
    ],
  },

  // ── 4-3-3 staggered ──
  {
    id: '4-3-3-staggered',
    name: '4-3-3 staggered',
    positions: [
      pos(0.18, 0.15, 'FB', 3),   // left FB
      pos(0.12, 0.38, 'CB', 5),
      pos(0.12, 0.62, 'CB', 4),
      pos(0.18, 0.85, 'FB', 2),   // right FB
      pos(0.38, 0.50, 'DM', 6),
      pos(0.53, 0.25, 'CM', 8),
      pos(0.53, 0.75, 'CM', 10),
      pos(0.80, 0.20, 'LW', 11),  // left winger
      pos(0.80, 0.50, 'CF', 9),
      pos(0.80, 0.80, 'RW', 7),   // right winger
    ],
  },

  // ── 4-2-3-1 ──
  {
    id: '4-2-3-1',
    name: '4-2-3-1',
    positions: [
      pos(0.18, 0.15, 'FB', 3),   // left FB
      pos(0.12, 0.38, 'CB', 5),
      pos(0.12, 0.62, 'CB', 4),
      pos(0.18, 0.85, 'FB', 2),   // right FB
      pos(0.38, 0.30, 'DM', 6),
      pos(0.38, 0.70, 'DM', 8),
      pos(0.60, 0.20, 'LW', 11),  // left winger
      pos(0.60, 0.50, 'OM', 10),
      pos(0.60, 0.80, 'RW', 7),   // right winger
      pos(0.82, 0.50, 'CF', 9),
    ],
  },

  // ── 4-1-4-1 ──
  {
    id: '4-1-4-1',
    name: '4-1-4-1',
    positions: [
      pos(0.18, 0.15, 'FB', 3),   // left FB
      pos(0.12, 0.38, 'CB', 5),
      pos(0.12, 0.62, 'CB', 4),
      pos(0.18, 0.85, 'FB', 2),   // right FB
      pos(0.36, 0.50, 'DM', 6),
      pos(0.56, 0.15, 'LW', 11),  // left winger
      pos(0.56, 0.38, 'CM', 8),
      pos(0.56, 0.62, 'CM', 10),
      pos(0.56, 0.85, 'RW', 7),   // right winger
      pos(0.82, 0.50, 'CF', 9),
    ],
  },

  // ── 4-4-2 ──
  {
    id: '4-4-2',
    name: '4-4-2',
    positions: [
      pos(0.18, 0.15, 'FB', 3),   // left FB
      pos(0.12, 0.38, 'CB', 5),
      pos(0.12, 0.62, 'CB', 4),
      pos(0.18, 0.85, 'FB', 2),   // right FB
      pos(0.48, 0.15, 'LW', 11),  // left winger
      pos(0.48, 0.38, 'CM', 8),
      pos(0.48, 0.62, 'CM', 6),
      pos(0.48, 0.85, 'RW', 7),   // right winger
      pos(0.80, 0.30, 'CF', 9),
      pos(0.80, 0.70, 'CF', 10),
    ],
  },

  // ── 4-4-2 diamond ──
  {
    id: '4-4-2-diamond',
    name: '4-4-2 diamond',
    positions: [
      pos(0.18, 0.15, 'FB', 3),   // left FB
      pos(0.12, 0.38, 'CB', 5),
      pos(0.12, 0.62, 'CB', 4),
      pos(0.18, 0.85, 'FB', 2),   // right FB
      pos(0.36, 0.50, 'DM', 6),
      pos(0.50, 0.25, 'CM', 8),
      pos(0.50, 0.75, 'CM', 11),
      pos(0.64, 0.50, 'OM', 10),
      pos(0.82, 0.30, 'CF', 9),
      pos(0.82, 0.70, 'CF', 7),
    ],
  },

  // ── 4-2-2-2 wide ──
  {
    id: '4-2-2-2-wide',
    name: '4-2-2-2 wide',
    positions: [
      pos(0.18, 0.15, 'FB', 3),   // left FB
      pos(0.12, 0.38, 'CB', 5),
      pos(0.12, 0.62, 'CB', 4),
      pos(0.18, 0.85, 'FB', 2),   // right FB
      pos(0.38, 0.35, 'DM', 6),
      pos(0.38, 0.65, 'DM', 8),
      pos(0.58, 0.12, 'LW', 11),  // left winger
      pos(0.58, 0.88, 'RW', 7),   // right winger
      pos(0.80, 0.35, 'CF', 9),
      pos(0.80, 0.65, 'CF', 10),
    ],
  },

  // ── 4-2-2-2 narrow ──
  {
    id: '4-2-2-2-narrow',
    name: '4-2-2-2 narrow',
    positions: [
      pos(0.18, 0.15, 'FB', 3),   // left FB
      pos(0.12, 0.38, 'CB', 5),
      pos(0.12, 0.62, 'CB', 4),
      pos(0.18, 0.85, 'FB', 2),   // right FB
      pos(0.38, 0.35, 'DM', 6),
      pos(0.38, 0.65, 'DM', 8),
      pos(0.58, 0.35, 'OM', 10),
      pos(0.58, 0.65, 'OM', 11),
      pos(0.80, 0.35, 'CF', 9),
      pos(0.80, 0.65, 'CF', 7),
    ],
  },

  // ── 4-3-2-1 (Christmas tree) ──
  {
    id: '4-3-2-1',
    name: '4-3-2-1',
    positions: [
      pos(0.18, 0.15, 'FB', 3),   // left FB
      pos(0.12, 0.38, 'CB', 5),
      pos(0.12, 0.62, 'CB', 4),
      pos(0.18, 0.85, 'FB', 2),   // right FB
      pos(0.40, 0.25, 'CM', 6),
      pos(0.40, 0.50, 'CM', 8),
      pos(0.40, 0.75, 'CM', 11),
      pos(0.62, 0.30, 'OM', 10),
      pos(0.62, 0.70, 'OM', 7),
      pos(0.82, 0.50, 'CF', 9),
    ],
  },

  // ── 3-5-2 flat ──
  {
    id: '3-5-2-flat',
    name: '3-5-2 flat',
    positions: [
      pos(0.18, 0.20, 'LCB', 5),
      pos(0.12, 0.50, 'CB', 4),
      pos(0.18, 0.80, 'RCB', 2),
      pos(0.48, 0.08, 'WB', 3),   // left WB
      pos(0.48, 0.28, 'CM', 6),
      pos(0.48, 0.50, 'CM', 8),
      pos(0.48, 0.72, 'CM', 10),
      pos(0.48, 0.92, 'WB', 11),  // right WB
      pos(0.80, 0.30, 'CF', 9),
      pos(0.80, 0.70, 'CF', 7),
    ],
  },

  // ── 3-5-2 (one DM) ──
  {
    id: '3-5-2-1dm',
    name: '3-5-2 (one DM)',
    positions: [
      pos(0.18, 0.20, 'LCB', 5),
      pos(0.12, 0.50, 'CB', 4),
      pos(0.18, 0.80, 'RCB', 2),
      pos(0.36, 0.50, 'DM', 6),
      pos(0.52, 0.08, 'WB', 3),   // left WB
      pos(0.55, 0.30, 'CM', 8),
      pos(0.55, 0.70, 'CM', 10),
      pos(0.52, 0.92, 'WB', 11),  // right WB
      pos(0.80, 0.30, 'CF', 9),
      pos(0.80, 0.70, 'CF', 7),
    ],
  },

  // ── 3-5-2 (two DMs) ──
  {
    id: '3-5-2-2dm',
    name: '3-5-2 (two DMs)',
    positions: [
      pos(0.18, 0.20, 'LCB', 5),
      pos(0.12, 0.50, 'CB', 4),
      pos(0.18, 0.80, 'RCB', 2),
      pos(0.36, 0.35, 'DM', 6),
      pos(0.36, 0.65, 'DM', 8),
      pos(0.52, 0.08, 'WB', 3),   // left WB
      pos(0.58, 0.50, 'OM', 10),
      pos(0.52, 0.92, 'WB', 11),  // right WB
      pos(0.80, 0.30, 'CF', 9),
      pos(0.80, 0.70, 'CF', 7),
    ],
  },

  // ── 3-4-3 flat ──
  {
    id: '3-4-3-flat',
    name: '3-4-3 flat',
    positions: [
      pos(0.18, 0.20, 'LCB', 5),
      pos(0.12, 0.50, 'CB', 4),
      pos(0.18, 0.80, 'RCB', 2),
      pos(0.48, 0.10, 'WB', 3),   // left WB
      pos(0.48, 0.38, 'CM', 6),
      pos(0.48, 0.62, 'CM', 8),
      pos(0.48, 0.90, 'WB', 11),  // right WB
      pos(0.80, 0.20, 'LW', 10),  // left winger
      pos(0.80, 0.50, 'CF', 9),
      pos(0.80, 0.80, 'RW', 7),   // right winger
    ],
  },

  // ── 3-4-3 (two 10s) ──
  {
    id: '3-4-3-2tens',
    name: '3-4-3 (two 10s)',
    positions: [
      pos(0.18, 0.20, 'LCB', 5),
      pos(0.12, 0.50, 'CB', 4),
      pos(0.18, 0.80, 'RCB', 2),
      pos(0.40, 0.08, 'WB', 3),   // left WB
      pos(0.40, 0.38, 'CM', 6),
      pos(0.40, 0.62, 'CM', 8),
      pos(0.40, 0.92, 'WB', 11),  // right WB
      pos(0.62, 0.30, 'OM', 10),
      pos(0.62, 0.70, 'OM', 7),
      pos(0.82, 0.50, 'CF', 9),
    ],
  },

  // ── 3-4-3 (two strikers) ──
  {
    id: '3-4-3-2cf',
    name: '3-4-3 (two strikers)',
    positions: [
      pos(0.18, 0.20, 'LCB', 5),
      pos(0.12, 0.50, 'CB', 4),
      pos(0.18, 0.80, 'RCB', 2),
      pos(0.40, 0.08, 'WB', 3),   // left WB
      pos(0.40, 0.38, 'CM', 6),
      pos(0.40, 0.62, 'CM', 8),
      pos(0.40, 0.92, 'WB', 11),  // right WB
      pos(0.60, 0.50, 'OM', 10),
      pos(0.82, 0.30, 'CF', 9),
      pos(0.82, 0.70, 'CF', 7),
    ],
  },

  // ── 5-3-2 ──
  {
    id: '5-3-2',
    name: '5-3-2',
    positions: [
      pos(0.18, 0.10, 'WB', 3),   // left WB
      pos(0.12, 0.30, 'LCB', 5),
      pos(0.12, 0.50, 'CB', 4),
      pos(0.12, 0.70, 'RCB', 2),
      pos(0.18, 0.90, 'WB', 11),  // right WB
      pos(0.48, 0.20, 'DM', 6),
      pos(0.48, 0.50, 'CM', 8),
      pos(0.48, 0.80, 'OM', 10),
      pos(0.80, 0.30, 'CF', 9),
      pos(0.80, 0.70, 'CF', 7),
    ],
  },
];
