import { deriveTheme } from '../utils/colorDerivation';

/** The 4 core branding defaults (dark mode). */
export const THEME_DEFAULTS = {
  primary: '#0a0e1a',      // UI background
  secondary: '#e2e8f0',    // Text & icons
  highlight: '#f59e0b',    // Accent / highlight
  background: '#0d1117',   // Board background
} as const;

/** Light mode core branding defaults. */
export const THEME_DEFAULTS_LIGHT = {
  primary: '#f5f5f5',      // Light gray UI background
  secondary: '#1e293b',    // Dark slate text & icons
  highlight: '#d97706',    // Amber-600 (darker for contrast on light bg)
  background: '#e0e0e0',   // Light gray board background (slightly darker than UI)
} as const;

/** Full derived theme (used as fallback when no branding is active). */
const derived = deriveTheme(
  THEME_DEFAULTS.primary,
  THEME_DEFAULTS.secondary,
  THEME_DEFAULTS.highlight,
  THEME_DEFAULTS.background,
);

export const THEME = {
  ...derived,

  // ── Legacy aliases (used during incremental migration) ──
  bg: derived.primary,
  text: derived.secondary,
  accent: derived.highlight,
  accentHover: derived.highlightHover,

  // ── Pitch-specific (not part of branding) ──
  pitchGreen: '#1a5c2a',
  pitchStripe: '#1e6b32',
  pitchLines: 'rgba(255, 255, 255, 0.9)',
  pitchBackground: derived.background,

  // ── Player token defaults ──
  teamA: '#ef4444',
  teamB: '#3b82f6',
} as const;
