import { useAppState } from '../../state/AppStateContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import { hexToRgba } from '../../utils/colorUtils';

function ToggleButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const theme = useThemeColors();
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '3px 10px',
        fontSize: 11,
        fontFamily: 'inherit',
        border: active ? `1px solid ${theme.accent}` : '1px solid #374151',
        borderRadius: 4,
        background: active ? hexToRgba(theme.accent, 0.15) : 'transparent',
        color: disabled ? '#4b5563' : active ? theme.accent : '#94a3b8',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

function PossessionButton({
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
        padding: '3px 10px',
        fontSize: 11,
        fontFamily: 'inherit',
        border: active ? `1px solid ${theme.accent}` : '1px solid #374151',
        borderRadius: 4,
        background: active ? hexToRgba(theme.accent, 0.1) : 'transparent',
        color: active ? theme.accent : '#94a3b8',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  );
}

const PlayIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="6,4 20,12 6,20" />
  </svg>
);

const TrashIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </svg>
);

const ExportIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

interface QuickBarProps {
  onPlayLines?: () => void;
  onExportLines?: () => void;
}

export function QuickBar({ onPlayLines, onExportLines }: QuickBarProps) {
  const { state, dispatch } = useAppState();
  const theme = useThemeColors();

  const canToggleCoverShadow = state.showOrientation;

  const hasAnnotations = state.annotations.length > 0;

  const hasLineAnnotations = state.annotations.some(
    a => a.type === 'passing-line' || a.type === 'running-line' || a.type === 'curved-run' || a.type === 'dribble-line',
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '4px 12px',
        background: '#111827',
        borderTop: '1px solid #1e293b',
        height: 32,
        fontSize: 11,
      }}
    >
      {/* Display toggles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ToggleButton
          active={state.showOrientation}
          onClick={() =>
            dispatch({ type: 'SET_SHOW_ORIENTATION', show: !state.showOrientation })
          }
        >
          Orientation
          <span style={{ color: '#64748b', marginLeft: 4, fontSize: 10 }}>O</span>
        </ToggleButton>

        <ToggleButton
          active={state.showCoverShadow}
          disabled={!canToggleCoverShadow}
          onClick={() =>
            dispatch({ type: 'SET_SHOW_COVER_SHADOW', show: !state.showCoverShadow })
          }
        >
          Cover Shadow
          <span style={{ color: '#64748b', marginLeft: 4, fontSize: 10 }}>C</span>
        </ToggleButton>

        <ToggleButton
          active={state.fovMode !== 'off'}
          disabled={!canToggleCoverShadow}
          onClick={() => {
            if (!canToggleCoverShadow) return;
            const cycle: Array<'off' | 'A' | 'B' | 'both'> = ['off', 'A', 'B', 'both'];
            const idx = cycle.indexOf(state.fovMode);
            const next = cycle[(idx + 1) % cycle.length];
            dispatch({ type: 'SET_FOV_MODE', mode: next });
          }}
        >
          FOV{state.fovMode !== 'off' && (
            <span style={{ color: theme.accent, marginLeft: 2, fontSize: 9 }}>
              {state.fovMode === 'A' ? 'A' : state.fovMode === 'B' ? 'B' : '✓'}
            </span>
          )}
          <span style={{ color: '#64748b', marginLeft: 4, fontSize: 10 }}>V</span>
        </ToggleButton>
      </div>

      {/* Separator */}
      <div style={{ width: 1, height: 18, background: '#1e293b' }} />

      {/* Possession toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 10, color: '#64748b', marginRight: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Possession
        </span>
        <PossessionButton
          active={state.possession === 'A'}
          onClick={() => dispatch({ type: 'SET_POSSESSION', possession: 'A' })}
        >
          {state.teamAName}
        </PossessionButton>
        <PossessionButton
          active={state.possession === 'auto'}
          onClick={() => dispatch({ type: 'SET_POSSESSION', possession: 'auto' })}
        >
          Auto
        </PossessionButton>
        <PossessionButton
          active={state.possession === 'B'}
          onClick={() => dispatch({ type: 'SET_POSSESSION', possession: 'B' })}
        >
          {state.teamBName}
        </PossessionButton>
      </div>

      {/* Play Lines / Export Lines */}
      {hasLineAnnotations && (
        <>
          <div style={{ width: 1, height: 18, background: '#1e293b' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={onPlayLines}
              disabled={state.annotationPlayback}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 10px',
                fontSize: 11,
                fontFamily: 'inherit',
                border: state.annotationPlayback ? `1px solid ${theme.accent}` : '1px solid #374151',
                borderRadius: 4,
                background: state.annotationPlayback ? hexToRgba(theme.accent, 0.15) : 'transparent',
                color: state.annotationPlayback ? theme.accent : '#94a3b8',
                cursor: state.annotationPlayback ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
                opacity: state.annotationPlayback ? 0.7 : 1,
              }}
            >
              <PlayIcon />
              Play Lines
            </button>
            <button
              onClick={onExportLines}
              disabled={state.annotationPlayback}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 10px',
                fontSize: 11,
                fontFamily: 'inherit',
                border: '1px solid #374151',
                borderRadius: 4,
                background: 'transparent',
                color: state.annotationPlayback ? '#4b5563' : '#94a3b8',
                cursor: state.annotationPlayback ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
                opacity: state.annotationPlayback ? 0.5 : 1,
              }}
            >
              <ExportIcon />
              Export
            </button>
          </div>
        </>
      )}

      {/* Clear All Annotations */}
      {hasAnnotations && (
        <>
          <div style={{ width: 1, height: 18, background: '#1e293b' }} />
          <button
            onClick={() => dispatch({ type: 'CLEAR_ALL_ANNOTATIONS' })}
            disabled={state.annotationPlayback}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 10px',
              fontSize: 11,
              fontFamily: 'inherit',
              border: '1px solid #374151',
              borderRadius: 4,
              background: 'transparent',
              color: state.annotationPlayback ? '#4b5563' : '#ef4444',
              cursor: state.annotationPlayback ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
              opacity: state.annotationPlayback ? 0.5 : 1,
            }}
          >
            <TrashIcon />
            Clear All
          </button>
        </>
      )}
    </div>
  );
}
