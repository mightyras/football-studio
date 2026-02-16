import { createContext, useContext, useEffect, useReducer, useRef, type ReactNode } from 'react';
import type { AppState, SceneData } from '../types';
import { appStateReducer, computePossession, defaultFacing, initialState, type AppAction } from './appStateReducer';

const STORAGE_KEY = 'football-studio-state';

/**
 * Fields to persist — everything meaningful, excluding transient UI state.
 */
function saveable(state: AppState): Partial<AppState> {
  return {
    players: state.players,
    ball: state.ball,
    activeTool: state.activeTool,
    activeTeam: state.activeTeam,
    teamAName: state.teamAName,
    teamBName: state.teamBName,
    teamAColor: state.teamAColor,
    teamBColor: state.teamBColor,
    teamAOutlineColor: state.teamAOutlineColor,
    teamBOutlineColor: state.teamBOutlineColor,
    playerRadius: state.playerRadius,
    possession: state.possession,
    showOrientation: state.showOrientation,
    showCoverShadow: state.showCoverShadow,
    fovMode: state.fovMode,
    fovExpanded: state.fovExpanded,
    teamADirection: state.teamADirection,
    teamAFormation: state.teamAFormation,
    teamBFormation: state.teamBFormation,
    pitchSettings: state.pitchSettings,
    substitutesA: state.substitutesA,
    substitutesB: state.substitutesB,
    annotations: state.annotations,
    animationMode: state.animationMode,
    animationSequence: state.animationSequence,
    clubIdentity: state.clubIdentity,
  };
}

/**
 * Extract scene-relevant fields from current state, deep-cloned for safe storage.
 */
export function extractSceneData(state: AppState): SceneData {
  return structuredClone({
    players: state.players,
    ball: state.ball,
    annotations: state.annotations,
    teamAName: state.teamAName,
    teamBName: state.teamBName,
    teamAColor: state.teamAColor,
    teamBColor: state.teamBColor,
    teamAOutlineColor: state.teamAOutlineColor,
    teamBOutlineColor: state.teamBOutlineColor,
    teamADirection: state.teamADirection,
    teamAFormation: state.teamAFormation,
    teamBFormation: state.teamBFormation,
    playerRadius: state.playerRadius,
    pitchSettings: state.pitchSettings,
    showOrientation: state.showOrientation,
    showCoverShadow: state.showCoverShadow,
    fovMode: state.fovMode,
    fovExpanded: state.fovExpanded,
    possession: state.possession,
    substitutesA: state.substitutesA,
    substitutesB: state.substitutesB,
    animationMode: state.animationMode,
    animationSequence: state.animationSequence,
  });
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const saved = JSON.parse(raw) as Partial<AppState>;
    // Merge saved state onto defaults so any new fields get initial values
    const merged = { ...initialState, ...saved };

    // Migrate nested objects: ensure ball has all required fields
    // (old saves may have `rotation` instead of `rotationX`/`rotationY`)
    if (saved.ball) {
      merged.ball = { ...initialState.ball, ...saved.ball };
    }

    // Migrate players: ensure facing and isGK fields exist
    // (old saves won't have facing — default to facing opponent's goal)
    // (old saves won't have isGK — infer from number === 1)
    if (saved.players) {
      merged.players = saved.players.map(p => ({
        ...p,
        facing: p.facing ?? defaultFacing(p.team, merged.teamADirection),
        ...(p.isGK === undefined && p.number === 1 ? { isGK: true } : {}),
      }));
    }

    // Migrate pitchSettings: ensure stadiumEnabled exists
    if (saved.pitchSettings) {
      merged.pitchSettings = { ...initialState.pitchSettings, ...saved.pitchSettings };
    }

    // Migrate substitutes: ensure arrays exist
    if (!merged.substitutesA) merged.substitutesA = [];
    if (!merged.substitutesB) merged.substitutesB = [];
    if (merged.activeBench === undefined) merged.activeBench = null;

    // Migrate annotations: ensure array exists
    if (!merged.annotations) merged.annotations = [];

    // Migrate outline colors: default to black
    if (!merged.teamAOutlineColor) merged.teamAOutlineColor = '#000000';
    if (!merged.teamBOutlineColor) merged.teamBOutlineColor = '#000000';

    // Migrate club identity: ensure object exists with all fields
    if (!merged.clubIdentity) {
      merged.clubIdentity = { logoDataUrl: null, primaryColor: null, secondaryColor: null, clubName: null };
    }

    // Migrate animation fields
    if (merged.animationMode === undefined) merged.animationMode = false;
    if (merged.animationSequence === undefined) merged.animationSequence = null;
    if (merged.activeKeyframeIndex === undefined) merged.activeKeyframeIndex = null;
    // Annotation playback is transient — always start as false
    merged.annotationPlayback = false;

    // Recompute resolved possession from loaded state
    merged.resolvedPossession = computePossession(merged.players, merged.ball, merged.possession, 'A');

    return merged;
  } catch {
    return initialState;
  }
}

interface AppStateContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  // Use a ref so HMR picks up the latest reducer without requiring a full reload
  const reducerRef = useRef(appStateReducer);
  reducerRef.current = appStateReducer;
  const [state, dispatch] = useReducer(
    (state: AppState, action: AppAction) => reducerRef.current(state, action),
    undefined,
    loadState,
  );

  // Persist to localStorage on every meaningful state change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saveable(state)));
    } catch {
      // Storage full or unavailable — silently ignore
    }
  }, [state]);

  return (
    <AppStateContext.Provider value={{ state, dispatch }}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return context;
}
