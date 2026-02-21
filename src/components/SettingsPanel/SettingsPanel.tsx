import { useState } from 'react';
import { useAppState } from '../../state/AppStateContext';
import type { AttackDirection, PitchRotation, ZoneDirection } from '../../types';
import { ColorSwatchPicker } from './ColorSwatchPicker';
import { CollapsibleSection, ColorDot, sectionStyle, labelStyle } from './CollapsibleSection';
import { useThemeColors } from '../../hooks/useThemeColors';
import { hexToRgba } from '../../utils/colorUtils';

const GRASS_PRESETS = [
  { label: 'Dark', grass: '#1a5c2a', stripe: '#1e6b32' },
  { label: 'Faded', grass: '#3a6b4a', stripe: '#3f755a' },
  { label: 'Black', grass: '#111111', stripe: '#1a1a1a' },
  { label: 'Obsidian', grass: '#1a1a2e', stripe: '#22223a' },
  { label: 'White', grass: '#d4d4d4', stripe: '#c4c4c4' },
];

const getSmallLabelStyle = (theme: ReturnType<typeof useThemeColors>): React.CSSProperties => ({
  fontSize: 11,
  color: theme.textMuted,
  marginBottom: 4,
  display: 'block',
});

function DirectionButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const theme = useThemeColors();
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '5px 8px',
        fontSize: 11,
        fontFamily: 'inherit',
        border: active ? `1px solid ${theme.highlight}` : `1px solid ${theme.borderSubtle}`,
        borderRadius: 4,
        background: active ? hexToRgba(theme.highlight, 0.1) : 'transparent',
        color: active ? theme.highlight : theme.textMuted,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  );
}

/**
 * Map world-space 'up' direction to a screen-space arrow based on pitch rotation.
 * rotation 0 = 0°, 1 = 90°CW, 2 = 180°, 3 = 270°CW.
 * 'up' in world means toward low-X (top of default pitch).
 */
function directionArrow(worldDir: 'up' | 'down', rotation: PitchRotation): string {
  // Screen arrow for world 'up' at each rotation:
  // rot 0: ↑, rot 1 (90°CW): ←, rot 2 (180°): ↓, rot 3 (270°CW): →
  const upArrows = ['↑', '←', '↓', '→'];
  const downArrows = ['↓', '→', '↑', '←'];
  return worldDir === 'up' ? upArrows[rotation] : downArrows[rotation];
}

export function SettingsPanel({ rotation }: { rotation: PitchRotation }) {
  const { state, dispatch } = useAppState();
  const theme = useThemeColors();
  const smallLabelStyle = getSmallLabelStyle(theme);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        height: '100%',
      }}
    >
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 12px',
        }}
      >
        {/* Theme Mode */}
        <div style={sectionStyle(theme)}>
          <span style={labelStyle(theme)}>Appearance</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <DirectionButton
              active={state.themeMode === 'dark'}
              onClick={() => dispatch({ type: 'SET_THEME_MODE', mode: 'dark' })}
            >
              Dark
            </DirectionButton>
            <DirectionButton
              active={state.themeMode === 'light'}
              onClick={() => dispatch({ type: 'SET_THEME_MODE', mode: 'light' })}
            >
              Light
            </DirectionButton>
          </div>
        </div>

        {/* Attacking Direction */}
        <div style={sectionStyle(theme)}>
          <span style={labelStyle(theme)}>Attacking Direction</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <DirectionButton
              active={state.teamADirection === 'up'}
              onClick={() => dispatch({ type: 'SET_TEAM_DIRECTION', direction: 'up' as AttackDirection })}
            >
              {state.teamAName} {directionArrow('up', rotation)}
            </DirectionButton>
            <DirectionButton
              active={state.teamADirection === 'down'}
              onClick={() => dispatch({ type: 'SET_TEAM_DIRECTION', direction: 'down' as AttackDirection })}
            >
              {state.teamAName} {directionArrow('down', rotation)}
            </DirectionButton>
          </div>
        </div>

        {/* Pitch Settings */}
        <CollapsibleSection
          label="Pitch"
          preview={<ColorDot color={state.pitchSettings.grassColor} />}
        >
          {/* Grass color presets */}
          <span style={smallLabelStyle}>Grass Color</span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
            {GRASS_PRESETS.map(preset => {
              const isLight = parseInt(preset.grass.replace('#', '').substring(0, 2), 16) > 180;
              return (
                <button
                  key={preset.label}
                  onClick={() =>
                    dispatch({
                      type: 'SET_PITCH_SETTINGS',
                      settings: { grassColor: preset.grass, stripeColor: preset.stripe },
                    })
                  }
                  style={{
                    padding: '4px 8px',
                    fontSize: 10,
                    fontFamily: 'inherit',
                    border:
                      state.pitchSettings.grassColor === preset.grass
                        ? `1px solid ${theme.highlight}`
                        : isLight ? `1px solid ${theme.textMuted}` : `1px solid ${theme.borderSubtle}`,
                    borderRadius: 4,
                    background: preset.grass,
                    color: isLight ? '#1a1a1a' : '#ffffff',
                    cursor: 'pointer',
                    textShadow: isLight ? 'none' : '0 1px 2px rgba(0,0,0,0.5)',
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ ...smallLabelStyle, marginBottom: 0, whiteSpace: 'nowrap' }}>Custom</span>
            <input
              type="color"
              value={state.pitchSettings.grassColor}
              onChange={e => {
                const hex = e.target.value;
                // Derive a stripe color: slightly lighter variant
                const r = parseInt(hex.substring(1, 3), 16);
                const g = parseInt(hex.substring(3, 5), 16);
                const b = parseInt(hex.substring(5, 7), 16);
                const adj = (r + g + b) / 3 > 128 ? -12 : 12;
                const clamp = (v: number) => Math.max(0, Math.min(255, v + adj));
                const stripe = `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`;
                dispatch({ type: 'SET_PITCH_SETTINGS', settings: { grassColor: hex, stripeColor: stripe } });
              }}
              style={{
                width: 28,
                height: 22,
                padding: 0,
                border: `1px solid ${theme.borderSubtle}`,
                borderRadius: 3,
                background: 'transparent',
                cursor: 'pointer',
              }}
            />
            <span style={{ fontSize: 10, fontFamily: 'monospace', color: theme.textSubtle }}>
              {state.pitchSettings.grassColor}
            </span>
          </div>

          {/* Stripe toggle */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              fontSize: 12,
              color: theme.secondary,
            }}
          >
            <input
              type="checkbox"
              checked={state.pitchSettings.stripesEnabled}
              onChange={e =>
                dispatch({
                  type: 'SET_PITCH_SETTINGS',
                  settings: { stripesEnabled: e.target.checked },
                })
              }
              style={{
                accentColor: theme.highlight,
                width: 14,
                height: 14,
                cursor: 'pointer',
              }}
            />
            Show pitch stripes
          </label>

          {state.pitchSettings.stripesEnabled && (
            <>
              <span style={{ ...smallLabelStyle, marginTop: 8 }}>Stripe Opacity</span>
              <input
                type="range"
                min={0.05}
                max={1}
                step={0.05}
                value={state.pitchSettings.stripeOpacity}
                onChange={e =>
                  dispatch({
                    type: 'SET_PITCH_SETTINGS',
                    settings: { stripeOpacity: parseFloat(e.target.value) },
                  })
                }
                style={{
                  width: '100%',
                  accentColor: theme.highlight,
                  cursor: 'pointer',
                }}
              />
            </>
          )}
        </CollapsibleSection>

        {/* Zone Overlay — collapsible */}
        <CollapsibleSection
          label="Tactical Zones"
          preview={
            state.pitchSettings.zoneOverlay !== 'none' ? (
              <span style={{ fontSize: 10, color: theme.highlight }}>
                {state.pitchSettings.zoneOverlay === 'corridors' ? 'Corridors'
                  : state.pitchSettings.zoneOverlay === 'zones18' ? '18 Zones'
                  : state.pitchSettings.zoneOverlay === 'thirds' ? 'Thirds'
                  : state.pitchSettings.zoneOverlay === 'phases' ? 'Phases'
                  : ''}
              </span>
            ) : undefined
          }
        >
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {([
              { value: 'none', label: 'None' },
              { value: 'corridors', label: 'Corridors' },
              { value: 'zones18', label: '18 Zones' },
              { value: 'thirds', label: 'Thirds' },
              { value: 'phases', label: 'Phases' },
            ] as const).map(opt => (
              <DirectionButton
                key={opt.value}
                active={state.pitchSettings.zoneOverlay === opt.value}
                onClick={() =>
                  dispatch({
                    type: 'SET_PITCH_SETTINGS',
                    settings: { zoneOverlay: opt.value },
                  })
                }
              >
                {opt.label}
              </DirectionButton>
            ))}
          </div>

          {/* Zone direction toggle — only visible when a zone overlay is active */}
          {state.pitchSettings.zoneOverlay !== 'none' && (
            <>
              <span style={{ ...smallLabelStyle, marginTop: 8 }}>Attack Direction</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <DirectionButton
                  active={state.pitchSettings.zoneDirection === 'bottom-to-top'}
                  onClick={() =>
                    dispatch({
                      type: 'SET_PITCH_SETTINGS',
                      settings: { zoneDirection: 'bottom-to-top' as ZoneDirection },
                    })
                  }
                >
                  ↑ Attack
                </DirectionButton>
                <DirectionButton
                  active={state.pitchSettings.zoneDirection === 'top-to-bottom'}
                  onClick={() =>
                    dispatch({
                      type: 'SET_PITCH_SETTINGS',
                      settings: { zoneDirection: 'top-to-bottom' as ZoneDirection },
                    })
                  }
                >
                  ↓ Attack
                </DirectionButton>
              </div>

              <span style={{ ...smallLabelStyle, marginTop: 8 }}>Line Width</span>
              <input
                type="range"
                min={1}
                max={8}
                step={1}
                value={state.pitchSettings.zoneLineWidth}
                onChange={e =>
                  dispatch({
                    type: 'SET_PITCH_SETTINGS',
                    settings: { zoneLineWidth: parseFloat(e.target.value) },
                  })
                }
                style={{
                  width: '100%',
                  accentColor: theme.highlight,
                  cursor: 'pointer',
                }}
              />

              <span style={{ ...smallLabelStyle, marginTop: 8 }}>Line Color</span>
              <ColorSwatchPicker
                value={state.pitchSettings.zoneLineColor}
                onChange={color =>
                  dispatch({
                    type: 'SET_PITCH_SETTINGS',
                    settings: { zoneLineColor: color },
                  })
                }
              />

              <span style={{ ...smallLabelStyle, marginTop: 8 }}>Line Opacity</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={state.pitchSettings.zoneLineOpacity}
                onChange={e =>
                  dispatch({
                    type: 'SET_PITCH_SETTINGS',
                    settings: { zoneLineOpacity: parseFloat(e.target.value) },
                  })
                }
                style={{
                  width: '100%',
                  accentColor: theme.highlight,
                  cursor: 'pointer',
                }}
              />

              <span style={{ ...smallLabelStyle, marginTop: 8 }}>Tint Opacity</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={state.pitchSettings.zoneTintOpacity}
                onChange={e =>
                  dispatch({
                    type: 'SET_PITCH_SETTINGS',
                    settings: { zoneTintOpacity: parseFloat(e.target.value) },
                  })
                }
                style={{
                  width: '100%',
                  accentColor: theme.highlight,
                  cursor: 'pointer',
                }}
              />
            </>
          )}
        </CollapsibleSection>

        {/* Bench Settings */}
        <div style={sectionStyle(theme)}>
          <span style={labelStyle(theme)}>Bench</span>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              fontSize: 12,
              color: theme.secondary,
            }}
          >
            <input
              type="checkbox"
              checked={state.pitchSettings.stadiumEnabled}
              onChange={e =>
                dispatch({
                  type: 'SET_PITCH_SETTINGS',
                  settings: { stadiumEnabled: e.target.checked },
                })
              }
              style={{
                accentColor: theme.highlight,
                width: 14,
                height: 14,
                cursor: 'pointer',
              }}
            />
            Show benches
          </label>
        </div>

        {/* Player Settings */}
        <div style={sectionStyle(theme)}>
          <span style={labelStyle(theme)}>Players</span>

          <span style={smallLabelStyle}>Size</span>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {[
              { label: 'S', radius: 1.0 },
              { label: 'M', radius: 1.6 },
              { label: 'L', radius: 2.0 },
              { label: 'XL', radius: 2.5 },
            ].map(preset => (
              <button
                key={preset.label}
                onClick={() => dispatch({ type: 'SET_PLAYER_RADIUS', radius: preset.radius })}
                style={{
                  flex: 1,
                  padding: '4px 2px',
                  fontSize: 10,
                  fontFamily: 'inherit',
                  border:
                    state.playerRadius === preset.radius
                      ? `1px solid ${theme.highlight}`
                      : `1px solid ${theme.borderSubtle}`,
                  borderRadius: 4,
                  background:
                    state.playerRadius === preset.radius
                      ? hexToRgba(theme.highlight, 0.1)
                      : 'transparent',
                  color: state.playerRadius === preset.radius ? theme.highlight : theme.textMuted,
                  cursor: 'pointer',
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <input
            type="range"
            min={1.0}
            max={2.5}
            step={0.1}
            value={state.playerRadius}
            onChange={e =>
              dispatch({ type: 'SET_PLAYER_RADIUS', radius: parseFloat(e.target.value) })
            }
            style={{
              width: '100%',
              accentColor: theme.highlight,
              cursor: 'pointer',
            }}
          />
        </div>

        {/* Ball Settings */}
        <div style={sectionStyle(theme)}>
          <span style={labelStyle(theme)}>Ball</span>

          <span style={smallLabelStyle}>Size</span>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {[
              { label: 'S', radius: 0.6 },
              { label: 'M', radius: 1.0 },
              { label: 'L', radius: 1.5 },
              { label: 'XL', radius: 2.0 },
            ].map(preset => (
              <button
                key={preset.label}
                onClick={() => dispatch({ type: 'SET_BALL_RADIUS', radius: preset.radius })}
                style={{
                  flex: 1,
                  padding: '4px 2px',
                  fontSize: 10,
                  fontFamily: 'inherit',
                  border:
                    state.ball.radius === preset.radius
                      ? `1px solid ${theme.highlight}`
                      : `1px solid ${theme.borderSubtle}`,
                  borderRadius: 4,
                  background:
                    state.ball.radius === preset.radius
                      ? hexToRgba(theme.highlight, 0.1)
                      : 'transparent',
                  color: state.ball.radius === preset.radius ? theme.highlight : theme.textMuted,
                  cursor: 'pointer',
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <input
            type="range"
            min={0.5}
            max={2.5}
            step={0.1}
            value={state.ball.radius}
            onChange={e =>
              dispatch({ type: 'SET_BALL_RADIUS', radius: parseFloat(e.target.value) })
            }
            style={{
              width: '100%',
              accentColor: theme.highlight,
              cursor: 'pointer',
            }}
          />
        </div>

      </div>
    </div>
  );
}
