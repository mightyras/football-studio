import { useMemo } from 'react';
import { useAppState } from '../state/AppStateContext';
import { THEME } from '../constants/colors';

export type ThemeColors = {
  accent: string;
  accentHover: string;
};

/**
 * Returns the resolved accent colors — either from club identity or default theme.
 * Use this hook in any component that currently hardcodes #f59e0b.
 */
export function useThemeColors(): ThemeColors {
  const { state } = useAppState();
  return useMemo(() => ({
    accent: state.clubIdentity.primaryColor || THEME.accent,
    accentHover: state.clubIdentity.secondaryColor || THEME.accentHover,
  }), [state.clubIdentity.primaryColor, state.clubIdentity.secondaryColor]);
}
