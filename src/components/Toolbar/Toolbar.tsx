import { useAppState } from '../../state/AppStateContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import { hexToRgba } from '../../utils/colorUtils';
import { ToolButton } from './ToolButton';
import type { DrawSubTool } from '../../types';

const FormationMoveIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 9l-3 3 3 3" />
    <path d="M19 9l3 3-3 3" />
    <path d="M9 5l3-3 3 3" />
    <path d="M9 19l3 3 3-3" />
    <circle cx="8" cy="10" r="1.5" fill="currentColor" strokeWidth="0" />
    <circle cx="16" cy="10" r="1.5" fill="currentColor" strokeWidth="0" />
    <circle cx="12" cy="15" r="1.5" fill="currentColor" strokeWidth="0" />
  </svg>
);

const SelectIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
  </svg>
);

const AddIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

const DeleteIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const DrawIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 19l7-7 3 3-7 7-3-3z" />
    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
    <path d="M2 2l7.586 7.586" />
    <circle cx="11" cy="11" r="2" />
  </svg>
);

// ── Sub-tool icons (compact SVGs) ──

const TextSubIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 7 4 4 20 4 20 7" />
    <line x1="12" y1="4" x2="12" y2="20" />
    <line x1="8" y1="20" x2="16" y2="20" />
  </svg>
);

const PassLineSubIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="20" x2="18" y2="6" />
    <polyline points="14 6 18 6 18 10" />
  </svg>
);

const LoftedPassSubIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20 Q12 2 20 8" strokeDasharray="3 2" />
    <polyline points="16 6 20 8 18 12" />
  </svg>
);

const RunLineSubIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 3">
    <line x1="4" y1="20" x2="18" y2="6" />
    <polyline points="14 6 18 6 18 10" strokeDasharray="0" />
  </svg>
);

const CurvedRunSubIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 3">
    <path d="M4 20 Q4 6 18 6" />
    <polyline points="14 6 18 6 18 10" strokeDasharray="0" />
  </svg>
);

const DribbleSubIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20 Q8 14 10 16 Q12 18 14 12 Q16 6 18 8" />
    <polyline points="16 6 20 6 18 10" />
  </svg>
);

const PolygonSubIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 3 21 10 18 20 6 20 3 10" />
  </svg>
);

const PlayerPolySubIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 3 21 10 18 20 6 20 3 10" />
    <circle cx="12" cy="3" r="2" fill="currentColor" />
    <circle cx="21" cy="10" r="2" fill="currentColor" />
    <circle cx="3" cy="10" r="2" fill="currentColor" />
  </svg>
);

const EllipseSubIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="12" rx="10" ry="7" />
  </svg>
);

const PlayerLineSubIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="12" x2="20" y2="12" />
    <circle cx="4" cy="12" r="2" fill="currentColor" strokeWidth="1" />
    <circle cx="12" cy="12" r="2" fill="currentColor" strokeWidth="1" />
    <circle cx="20" cy="12" r="2" fill="currentColor" strokeWidth="1" />
  </svg>
);

const PlayerMarkingSubIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 6 L17 6 A6 6 0 0 1 17 18 L7 18 A6 6 0 0 1 7 6 Z" />
    <circle cx="8" cy="12" r="2" fill="currentColor" strokeWidth="0" />
    <circle cx="16" cy="12" r="2" fill="currentColor" strokeWidth="0" />
  </svg>
);

const ClearAllSubIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </svg>
);

// ── Sub-tool button (smaller) ──

function SubToolButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const theme = useThemeColors();
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: active ? `1px solid ${theme.highlight}` : '1px solid transparent',
        borderRadius: 4,
        background: active ? hexToRgba(theme.highlight, 0.15) : 'transparent',
        color: active ? theme.highlight : theme.textMuted,
        cursor: 'pointer',
        transition: 'all 0.15s',
        padding: 0,
      }}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.background = theme.surfaceHover;
          e.currentTarget.style.color = theme.secondary;
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = theme.textMuted;
        }
      }}
    >
      {children}
    </button>
  );
}

type SubToolEntry =
  | { type: 'tool'; subTool: DrawSubTool; icon: React.ReactNode; title: string }
  | { type: 'separator' };

const SUB_TOOLS: SubToolEntry[] = [
  // Line tools
  { type: 'tool', subTool: 'passing-line', icon: <PassLineSubIcon />, title: 'Passing Line (P)' },
  { type: 'tool', subTool: 'lofted-pass', icon: <LoftedPassSubIcon />, title: 'Lofted Pass (I)' },
  { type: 'tool', subTool: 'running-line', icon: <RunLineSubIcon />, title: 'Running Line (R)' },
  { type: 'tool', subTool: 'curved-run', icon: <CurvedRunSubIcon />, title: 'Curved Run (C)' },
  { type: 'tool', subTool: 'dribble-line', icon: <DribbleSubIcon />, title: 'Dribble Line (B)' },
  { type: 'separator' },
  // Freestanding shapes
  { type: 'tool', subTool: 'text', icon: <TextSubIcon />, title: 'Text (T)' },
  { type: 'tool', subTool: 'ellipse', icon: <EllipseSubIcon />, title: 'Ellipse (E)' },
  { type: 'tool', subTool: 'polygon', icon: <PolygonSubIcon />, title: 'Polygon (G)' },
  { type: 'separator' },
  // Player-connected tools
  { type: 'tool', subTool: 'player-line', icon: <PlayerLineSubIcon />, title: 'Player Line (L)' },
  { type: 'tool', subTool: 'player-polygon', icon: <PlayerPolySubIcon />, title: 'Player Polygon (H)' },
  { type: 'tool', subTool: 'player-marking', icon: <PlayerMarkingSubIcon />, title: 'Player Marking (M)' },
];

export function Toolbar() {
  const { state, dispatch } = useAppState();
  const theme = useThemeColors();

  const isDrawActive = state.activeTool === 'draw';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: '12px 0',
        background: theme.surface,
        borderRight: `1px solid ${theme.border}`,
        overflowY: 'auto',
      }}
    >
      <ToolButton
        active={state.activeTool === 'select'}
        onClick={() => dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'select' })}
        title="Select & Move (V)"
        dataTour="tool-select"
      >
        <SelectIcon />
      </ToolButton>

      <ToolButton
        active={state.activeTool === 'formation-move'}
        onClick={() => {
          if (state.activeTool === 'formation-move') {
            dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'select' });
          } else {
            dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'formation-move' });
          }
        }}
        title="Formation Move (X)"
        dataTour="tool-formation-move"
      >
        <FormationMoveIcon />
      </ToolButton>

      <ToolButton
        active={state.activeTool === 'add-player'}
        onClick={() => dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'add-player' })}
        title="Add Player (A)"
      >
        <AddIcon />
      </ToolButton>

      <ToolButton
        active={state.activeTool === 'delete'}
        onClick={() => dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'delete' })}
        title="Delete Player (D)"
      >
        <DeleteIcon />
      </ToolButton>

      <div style={{ height: 1, width: 28, background: theme.border, margin: '8px 0' }} />

      {/* Draw tool */}
      <ToolButton
        active={isDrawActive}
        onClick={() => {
          if (isDrawActive) {
            dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'select' });
          } else {
            dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'draw' });
          }
        }}
        title="Draw (W)"
        dataTour="tool-draw"
      >
        <DrawIcon />
      </ToolButton>

      {/* Sub-tools — visible when draw tool is active */}
      {isDrawActive && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            padding: '4px 0',
          }}
        >
          {SUB_TOOLS.map((entry, i) =>
            entry.type === 'separator' ? (
              <div key={`sep-${i}`} style={{ height: 1, width: 20, background: theme.borderSubtle, margin: '2px 0' }} />
            ) : (
              <SubToolButton
                key={entry.subTool}
                active={state.drawSubTool === entry.subTool}
                onClick={() => dispatch({ type: 'SET_DRAW_SUB_TOOL', subTool: entry.subTool })}
                title={entry.title}
              >
                {entry.icon}
              </SubToolButton>
            )
          )}
          {state.annotations.length > 0 && (
            <>
              <div style={{ height: 1, width: 20, background: theme.borderSubtle, margin: '2px 0' }} />
              <button
                onClick={() => dispatch({ type: 'CLEAR_ALL_ANNOTATIONS' })}
                title="Clear all annotations (⌘Z to undo)"
                style={{
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid transparent',
                  borderRadius: 4,
                  background: 'transparent',
                  color: '#ef4444',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  padding: 0,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                  e.currentTarget.style.borderColor = '#ef4444';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                <ClearAllSubIcon />
              </button>
            </>
          )}
        </div>
      )}

    </div>
  );
}
