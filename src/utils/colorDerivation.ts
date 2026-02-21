/**
 * Color derivation utilities for the dynamic theme system.
 *
 * All 4 branding inputs (primary, secondary, highlight, background)
 * are expanded into a full palette of derived tokens so that every
 * UI surface, border, text shade and accent is consistent.
 */

// ── Primitives ──

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    '#' +
    clamp(r).toString(16).padStart(2, '0') +
    clamp(g).toString(16).padStart(2, '0') +
    clamp(b).toString(16).padStart(2, '0')
  );
}

/** Lighten a hex color by `amount` (0–100). */
export function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const t = amount / 100;
  return rgbToHex(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t);
}

/** Darken a hex color by `amount` (0–100). */
export function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const t = 1 - amount / 100;
  return rgbToHex(r * t, g * t, b * t);
}

/** Mix two colors. ratio=0 → color1, ratio=1 → color2. */
export function mixColors(hex1: string, hex2: string, ratio: number): string {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  return rgbToHex(
    r1 + (r2 - r1) * ratio,
    g1 + (g2 - g1) * ratio,
    b1 + (b2 - b1) * ratio,
  );
}

// ── WCAG Contrast ──

/** Relative luminance per WCAG 2.1 */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two colors (1–21). */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** True when luminance is below 0.15 (i.e. a "dark" color). */
export function isDark(hex: string): boolean {
  return relativeLuminance(hex) < 0.15;
}

// ── Derived Theme ──

export type DerivedTheme = {
  // Core 4 inputs
  primary: string;
  secondary: string;
  highlight: string;
  background: string;

  // Derived from primary (UI background)
  surface: string;
  surfaceHover: string;
  border: string;
  borderSubtle: string;
  inputBg: string;

  // Derived from secondary (text)
  textMuted: string;
  textSubtle: string;

  // Derived from highlight (accent)
  highlightHover: string;

  // Legacy aliases (will be removed after full migration)
  accent: string;
  accentHover: string;
};

/**
 * Derive a complete UI palette from 4 branding inputs.
 *
 * The lightening / mixing percentages are tuned so that the default
 * inputs (#0a0e1a, #e2e8f0, #f59e0b, #0d1117) produce values that
 * closely match the original hardcoded colors used throughout the app.
 */
export function deriveTheme(
  primary: string,
  secondary: string,
  highlight: string,
  background: string,
): DerivedTheme {
  const dark = isDark(primary);

  return {
    // Pass-through
    primary,
    secondary,
    highlight,
    background,

    // Surfaces — for dark primary: lighten; for light primary: darken
    surface:      dark ? lighten(primary, 7)  : darken(primary, 4),
    surfaceHover: dark ? lighten(primary, 13) : darken(primary, 8),
    border:       dark ? lighten(primary, 11) : darken(primary, 10),
    borderSubtle: dark ? lighten(primary, 20) : darken(primary, 16),
    inputBg:      dark ? darken(primary, 6)   : lighten(primary, 3),

    // Text — blend secondary toward primary to mute
    textMuted: mixColors(secondary, primary, 0.38),
    textSubtle: mixColors(secondary, primary, 0.58),

    // Highlight variant
    highlightHover: darken(highlight, 15),

    // Legacy aliases
    accent: highlight,
    accentHover: darken(highlight, 15),
  };
}
