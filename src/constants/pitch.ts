export const PITCH = {
  length: 105,
  width: 68,
  centerCircleRadius: 9.15,
  centerSpotRadius: 0.3,
  penaltyAreaLength: 16.5,
  penaltyAreaWidth: 40.32,
  goalAreaLength: 5.5,
  goalAreaWidth: 18.32,
  penaltySpotDistance: 11,
  penaltyArcRadius: 9.15,
  cornerArcRadius: 1,
  goalWidth: 7.32,
  goalDepth: 2,
  lineWidth: 0.12,
  padding: 6,
} as const;

export const BENCH = {
  width: 4,     // bench depth in world units
  gap: 2,       // gap between pitch edge and bench
  // Both benches on the same sideline (low-Y / left side),
  // on opposite sides of the halfway line (52.5), with a small gap between them.
  aStartX: 27,  // Team A bench: left of halfway line
  aEndX: 50,
  bStartX: 55,  // Team B bench: right of halfway line
  bEndX: 78,
} as const;
