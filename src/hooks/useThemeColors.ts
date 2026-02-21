import { useMemo } from 'react';
import { useAppState } from '../state/AppStateContext';
import { useAuth } from '../state/AuthContext';
import { useTeam } from '../state/TeamContext';
import { THEME_DEFAULTS, THEME_DEFAULTS_LIGHT } from '../constants/colors';
import { deriveTheme, type DerivedTheme } from '../utils/colorDerivation';

export type ThemeColors = DerivedTheme;

const EMPTY_IDENTITY = {
  primaryColor: null,
  secondaryColor: null,
  highlightColor: null,
  backgroundColor: null,
};

/**
 * Returns the fully resolved theme palette.
 * Cascade: board-level ClubIdentity → team-level branding → global THEME_DEFAULTS.
 * ClubIdentity colors are only applied when the user is signed in.
 */
export function useThemeColors(): ThemeColors {
  const { state } = useAppState();
  const { user } = useAuth();
  const { activeTeam } = useTeam();

  return useMemo(() => {
    // Only apply board-level ClubIdentity colors when signed in
    const ci = user ? state.clubIdentity : EMPTY_IDENTITY;

    // Choose defaults based on theme mode
    const defaults = state.themeMode === 'light' ? THEME_DEFAULTS_LIGHT : THEME_DEFAULTS;

    const primary =
      ci.primaryColor || activeTeam?.primary_color || defaults.primary;
    const secondary =
      ci.secondaryColor || activeTeam?.secondary_color || defaults.secondary;
    const highlight =
      ci.highlightColor || activeTeam?.highlight_color || defaults.highlight;
    const background =
      ci.backgroundColor || activeTeam?.background_color || defaults.background;

    return deriveTheme(primary, secondary, highlight, background);
  }, [
    user,
    state.themeMode,
    state.clubIdentity.primaryColor,
    state.clubIdentity.secondaryColor,
    state.clubIdentity.highlightColor,
    state.clubIdentity.backgroundColor,
    activeTeam?.primary_color,
    activeTeam?.secondary_color,
    activeTeam?.highlight_color,
    activeTeam?.background_color,
  ]);
}
