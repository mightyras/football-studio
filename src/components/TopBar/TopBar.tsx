import { useState, useRef, useEffect } from 'react';
import { useAppState } from '../../state/AppStateContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import { hexToRgba } from '../../utils/colorUtils';

/* ── Editable team name (existing) ── */

function EditableTeamName({
  name,
  color,
  onRename,
}: {
  name: string;
  color: string;
  onRename: (name: string) => void;
}) {
  const theme = useThemeColors();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(name);
  }, [name]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function commit() {
    const trimmed = value.trim();
    if (trimmed && trimmed !== name) {
      onRename(trimmed);
    } else {
      setValue(name);
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: color,
            flexShrink: 0,
          }}
        />
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setValue(name);
              setEditing(false);
            }
          }}
          maxLength={20}
          style={{
            fontSize: 13,
            color: '#e2e8f0',
            background: '#0f172a',
            border: `1px solid ${theme.accent}`,
            borderRadius: 3,
            padding: '1px 6px',
            fontFamily: 'inherit',
            width: 120,
            outline: 'none',
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
      onClick={() => setEditing(true)}
      title="Click to rename"
    >
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: color,
        }}
      />
      <span
        style={{
          fontSize: 13,
          color: '#e2e8f0',
          borderBottom: '1px dashed #374151',
          paddingBottom: 1,
        }}
      >
        {name}
      </span>
    </div>
  );
}

/* ── SVG Icons ── */

const EyeIcon = ({ active, accentColor }: { active: boolean; accentColor: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? accentColor : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const PlayIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="6,4 20,12 6,20" />
  </svg>
);

const ExportIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const StepIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="4,4 14,12 4,20" />
    <rect x="16" y="4" width="3" height="16" />
  </svg>
);

const HelpIcon = ({ active, accentColor }: { active: boolean; accentColor: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? accentColor : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const GearIcon = ({ active, accentColor }: { active: boolean; accentColor: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? accentColor : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

/* ── Eye dropdown (Orientation + Cover Shadow) ── */

function DisplayDropdown() {
  const { state, dispatch } = useAppState();
  const theme = useThemeColors();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const hasActiveOverlay = state.showOrientation || state.showCoverShadow || state.fovMode !== 'off';

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(prev => !prev)}
        title="Display options"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          padding: '4px 8px',
          fontSize: 11,
          fontFamily: 'inherit',
          border: open ? `1px solid ${theme.accent}` : '1px solid transparent',
          borderRadius: 4,
          background: open ? hexToRgba(theme.accent, 0.15) : 'transparent',
          color: open ? theme.accent : hasActiveOverlay ? '#e2e8f0' : '#94a3b8',
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          if (!open) {
            e.currentTarget.style.background = '#1f2937';
            e.currentTarget.style.color = '#e2e8f0';
          }
        }}
        onMouseLeave={e => {
          if (!open) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = hasActiveOverlay ? '#e2e8f0' : '#94a3b8';
          }
        }}
      >
        <EyeIcon active={open} accentColor={theme.accent} />
        <span style={{ fontSize: 9, lineHeight: 1 }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 6,
            padding: '6px 0',
            minWidth: 180,
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 12,
              color: '#e2e8f0',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#334155'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <input
              type="checkbox"
              checked={state.showOrientation}
              onChange={() => dispatch({ type: 'SET_SHOW_ORIENTATION', show: !state.showOrientation })}
              style={{ accentColor: theme.accent }}
            />
            Orientation
            <span style={{ color: '#64748b', fontSize: 10, marginLeft: 'auto' }}>O</span>
          </label>
          {/* Orientation mode sub-items */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 12px 4px 24px',
              cursor: state.showOrientation ? 'pointer' : 'not-allowed',
              fontSize: 11,
              color: state.showOrientation ? '#cbd5e1' : '#4b5563',
              opacity: state.showOrientation ? 1 : 0.5,
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => {
              if (state.showOrientation) (e.currentTarget as HTMLElement).style.background = '#334155';
            }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <input
              type="radio"
              name="orientMode"
              checked={!state.autoOrientToBall}
              disabled={!state.showOrientation}
              onChange={() => dispatch({ type: 'SET_AUTO_ORIENT_TO_BALL', enabled: false })}
              style={{ accentColor: theme.accent }}
            />
            Manual
          </label>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 12px 4px 24px',
              cursor: state.showOrientation ? 'pointer' : 'not-allowed',
              fontSize: 11,
              color: state.showOrientation ? '#cbd5e1' : '#4b5563',
              opacity: state.showOrientation ? 1 : 0.5,
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => {
              if (state.showOrientation) (e.currentTarget as HTMLElement).style.background = '#334155';
            }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <input
              type="radio"
              name="orientMode"
              checked={state.autoOrientToBall}
              disabled={!state.showOrientation}
              onChange={() => dispatch({ type: 'SET_AUTO_ORIENT_TO_BALL', enabled: true })}
              style={{ accentColor: theme.accent }}
            />
            Auto (eyes on ball)
          </label>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              cursor: state.showOrientation ? 'pointer' : 'not-allowed',
              fontSize: 12,
              color: state.showOrientation ? '#e2e8f0' : '#4b5563',
              opacity: state.showOrientation ? 1 : 0.5,
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => {
              if (state.showOrientation) (e.currentTarget as HTMLElement).style.background = '#334155';
            }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <input
              type="checkbox"
              checked={state.showCoverShadow}
              disabled={!state.showOrientation}
              onChange={() => dispatch({ type: 'SET_SHOW_COVER_SHADOW', show: !state.showCoverShadow })}
              style={{ accentColor: theme.accent }}
            />
            Cover Shadow
            <span style={{ color: '#64748b', fontSize: 10, marginLeft: 'auto' }}>C</span>
          </label>
          {/* FOV mode divider */}
          <div style={{ height: 1, background: '#334155', margin: '4px 0' }} />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              cursor: state.showOrientation ? 'pointer' : 'not-allowed',
              fontSize: 12,
              color: state.showOrientation ? '#e2e8f0' : '#4b5563',
              opacity: state.showOrientation ? 1 : 0.5,
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => {
              if (state.showOrientation) (e.currentTarget as HTMLElement).style.background = '#334155';
            }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            onClick={() => {
              if (!state.showOrientation) return;
              const cycle: Array<'off' | 'A' | 'B' | 'both'> = ['off', 'A', 'B', 'both'];
              const idx = cycle.indexOf(state.fovMode);
              const next = cycle[(idx + 1) % cycle.length];
              dispatch({ type: 'SET_FOV_MODE', mode: next });
            }}
          >
            <span style={{ minWidth: 60 }}>FOV</span>
            <span style={{
              marginLeft: 'auto',
              fontSize: 10,
              color: state.fovMode === 'off' ? '#64748b' : theme.accent,
              fontWeight: state.fovMode === 'off' ? 400 : 600,
            }}>
              {state.fovMode === 'off' ? 'Off' : state.fovMode === 'A' ? 'My Team' : state.fovMode === 'B' ? 'Opposition' : 'Both'}
            </span>
            <span style={{ color: '#64748b', fontSize: 10 }}>V</span>
          </div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 12px 4px 24px',
              cursor: state.fovMode !== 'off' ? 'pointer' : 'not-allowed',
              fontSize: 11,
              color: state.fovMode !== 'off' ? '#cbd5e1' : '#4b5563',
              opacity: state.fovMode !== 'off' ? 1 : 0.5,
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => {
              if (state.fovMode !== 'off') (e.currentTarget as HTMLElement).style.background = '#334155';
            }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <input
              type="checkbox"
              checked={state.fovExpanded}
              disabled={state.fovMode === 'off'}
              onChange={() => dispatch({ type: 'SET_FOV_EXPANDED', expanded: !state.fovExpanded })}
              style={{ accentColor: theme.accent }}
            />
            Peripheral Vision
            <span style={{ color: '#64748b', fontSize: 10, marginLeft: 'auto' }}>⇧V</span>
          </label>
        </div>
      )}
    </div>
  );
}

/* ── Reset confirmation dialog ── */

function ResetConfirmDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const theme = useThemeColors();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onMouseDown={e => {
        if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
          onCancel();
        }
      }}
    >
      <div
        ref={dialogRef}
        style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 8,
          padding: '20px 24px',
          maxWidth: 380,
          width: '90%',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
        }}
      >
        <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 600, color: '#e2e8f0' }}>
          Reset Board?
        </h3>
        <p style={{ margin: '0 0 18px', fontSize: 12, lineHeight: 1.5, color: '#94a3b8' }}>
          This will reset all player names, numbers, and positions to defaults, remove all
          annotations and animations, and reset team names. Team colors will be kept.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              padding: '6px 16px',
              fontSize: 12,
              fontFamily: 'inherit',
              border: '1px solid #334155',
              borderRadius: 4,
              background: 'transparent',
              color: '#94a3b8',
              cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#334155'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '6px 16px',
              fontSize: 12,
              fontFamily: 'inherit',
              border: `1px solid ${theme.accent}`,
              borderRadius: 4,
              background: hexToRgba(theme.accent, 0.15),
              color: theme.accent,
              cursor: 'pointer',
              fontWeight: 600,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = hexToRgba(theme.accent, 0.3); }}
            onMouseLeave={e => { e.currentTarget.style.background = hexToRgba(theme.accent, 0.15); }}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── TopBar (main export) ── */

interface TopBarProps {
  onPlayLines?: () => void;
  onStepLines?: () => void;
  onExportLines?: () => void;
  showPanel: boolean;
  onTogglePanel: () => void;
  onOpenHelp: () => void;
  helpActive: boolean;
}

export function TopBar({ onPlayLines, onStepLines, onExportLines, showPanel, onTogglePanel, onOpenHelp, helpActive }: TopBarProps) {
  const { state, dispatch } = useAppState();
  const theme = useThemeColors();
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const hasLineAnnotations = state.annotations.some(
    a => a.type === 'passing-line' || a.type === 'running-line' || a.type === 'curved-run' || a.type === 'dribble-line',
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        background: '#111827',
        borderBottom: '1px solid #1e293b',
        height: 48,
      }}
    >
      {/* Left: Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {state.clubIdentity.logoDataUrl && (
          <img
            src={state.clubIdentity.logoDataUrl}
            alt="Club logo"
            style={{
              width: 28,
              height: 28,
              objectFit: 'contain',
              borderRadius: 4,
              flexShrink: 0,
            }}
          />
        )}
        <span
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: theme.accent,
            letterSpacing: '-0.02em',
          }}
        >
          Football Tactics Studio
        </span>
      </div>

      {/* Center: Team names */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <EditableTeamName
          name={state.teamAName}
          color={state.teamAColor}
          onRename={name => dispatch({ type: 'RENAME_TEAM', team: 'A', name })}
        />
        <span style={{ color: '#374151', fontSize: 13 }}>vs</span>
        <EditableTeamName
          name={state.teamBName}
          color={state.teamBColor}
          onRename={name => dispatch({ type: 'RENAME_TEAM', team: 'B', name })}
        />

        <button
          onClick={() => setShowResetConfirm(true)}
          style={{
            padding: '4px 12px',
            fontSize: 12,
            border: '1px solid #1e293b',
            borderRadius: 4,
            background: 'transparent',
            color: '#94a3b8',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = theme.accent;
            e.currentTarget.style.color = theme.accent;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = '#1e293b';
            e.currentTarget.style.color = '#94a3b8';
          }}
        >
          Reset
        </button>
      </div>

      {/* Right: Display dropdown + Play/Export + Panel toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {/* Display options (Orientation / Cover Shadow) */}
        <DisplayDropdown />

        {/* Play Lines / Export (conditional) */}
        {hasLineAnnotations && (
          <>
            <div style={{ width: 1, height: 18, background: '#334155', flexShrink: 0 }} />
            <button
              onClick={() =>
                dispatch({ type: 'SET_SHOW_STEP_NUMBERS', show: !state.showStepNumbers })
              }
              title="Toggle step number badges"
              style={{
                padding: '4px 10px',
                fontSize: 11,
                fontFamily: 'inherit',
                border: state.showStepNumbers ? `1px solid ${theme.accent}` : '1px solid #374151',
                borderRadius: 4,
                background: state.showStepNumbers ? hexToRgba(theme.accent, 0.15) : 'transparent',
                color: state.showStepNumbers ? theme.accent : '#94a3b8',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              Steps
            </button>
            <button
              onClick={onPlayLines}
              title="Play line animations (Space)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 10px',
                fontSize: 11,
                fontFamily: 'inherit',
                border: '1px solid #374151',
                borderRadius: 4,
                background: 'transparent',
                color: '#94a3b8',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <PlayIcon />
              Play
            </button>
            <button
              onClick={onStepLines}
              title="Step through animation (→ arrow)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 10px',
                fontSize: 11,
                fontFamily: 'inherit',
                border: '1px solid #374151',
                borderRadius: 4,
                background: 'transparent',
                color: '#94a3b8',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <StepIcon />
              Step
            </button>
            <button
              onClick={onExportLines}
              title="Export line animations"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 10px',
                fontSize: 11,
                fontFamily: 'inherit',
                border: '1px solid #374151',
                borderRadius: 4,
                background: 'transparent',
                color: '#94a3b8',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <ExportIcon />
              Export
            </button>
          </>
        )}

        {/* Separator */}
        <div style={{ width: 1, height: 18, background: '#334155', flexShrink: 0 }} />

        {/* Help button */}
        <button
          onClick={onOpenHelp}
          title="Help"
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '4px 8px',
            fontSize: 11,
            fontFamily: 'inherit',
            border: helpActive ? `1px solid ${theme.accent}` : '1px solid transparent',
            borderRadius: 4,
            background: helpActive ? hexToRgba(theme.accent, 0.15) : 'transparent',
            color: helpActive ? theme.accent : '#94a3b8',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            if (!helpActive) {
              e.currentTarget.style.background = '#1f2937';
              e.currentTarget.style.color = '#e2e8f0';
            }
          }}
          onMouseLeave={e => {
            if (!helpActive) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#94a3b8';
            }
          }}
        >
          <HelpIcon active={helpActive} accentColor={theme.accent} />
        </button>

        {/* Panel toggle */}
        <button
          onClick={onTogglePanel}
          title={showPanel ? 'Hide panel' : 'Show formations & settings'}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '4px 8px',
            fontSize: 11,
            fontFamily: 'inherit',
            border: showPanel ? `1px solid ${theme.accent}` : '1px solid transparent',
            borderRadius: 4,
            background: showPanel ? hexToRgba(theme.accent, 0.15) : 'transparent',
            color: showPanel ? theme.accent : '#94a3b8',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            if (!showPanel) {
              e.currentTarget.style.background = '#1f2937';
              e.currentTarget.style.color = '#e2e8f0';
            }
          }}
          onMouseLeave={e => {
            if (!showPanel) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#94a3b8';
            }
          }}
        >
          <GearIcon active={showPanel} accentColor={theme.accent} />
        </button>
      </div>

      {/* Reset confirmation dialog */}
      {showResetConfirm && (
        <ResetConfirmDialog
          onConfirm={() => {
            dispatch({ type: 'RESET' });
            setShowResetConfirm(false);
          }}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}
    </div>
  );
}
