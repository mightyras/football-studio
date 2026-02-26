import { useState, useRef, useEffect } from 'react';
import { useAppState } from '../../state/AppStateContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import { hexToRgba } from '../../utils/colorUtils';
import { useAuth } from '../../state/AuthContext';
import { useTeam } from '../../state/TeamContext';
import { AuthModal } from '../AuthModal/AuthModal';
import { UserMenu } from '../AuthModal/UserMenu';
import { TeamOverlay, FormationDropdown, getFormationName } from './TeamOverlay';

/* ── Team name trigger (opens overlay) ── */

function TeamNameTrigger({
  name,
  color,
  outlineColor,
  active,
  onClick,
}: {
  name: string;
  color: string;
  outlineColor: string;
  active: boolean;
  onClick: () => void;
}) {
  const theme = useThemeColors();
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
        background: active ? theme.surfaceHover : 'transparent',
        border: active ? `1px solid ${theme.borderSubtle}` : '1px solid transparent',
        borderRadius: 4,
        padding: '3px 8px',
        fontFamily: 'inherit',
        transition: 'all 0.15s',
      }}
    >
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: color,
          border: `2px solid ${outlineColor}`,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: 13,
          color: theme.secondary,
        }}
      >
        {name}
      </span>
    </button>
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

const BoardsIcon = ({ active, accentColor }: { active: boolean; accentColor: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? accentColor : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
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
    <div ref={dropdownRef} style={{ position: 'relative' }} data-tour="display-options">
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
          border: open ? `1px solid ${theme.highlight}` : '1px solid transparent',
          borderRadius: 4,
          background: open ? hexToRgba(theme.highlight, 0.15) : 'transparent',
          color: open ? theme.highlight : hasActiveOverlay ? theme.secondary : theme.textMuted,
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          if (!open) {
            e.currentTarget.style.background = theme.surfaceHover;
            e.currentTarget.style.color = theme.secondary;
          }
        }}
        onMouseLeave={e => {
          if (!open) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = hasActiveOverlay ? theme.secondary : theme.textMuted;
          }
        }}
      >
        <EyeIcon active={open} accentColor={theme.highlight} />
        <span style={{ fontSize: 9, lineHeight: 1 }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            background: theme.border,
            border: `1px solid ${theme.borderSubtle}`,
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
              color: theme.secondary,
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = theme.borderSubtle; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <input
              type="checkbox"
              checked={state.showOrientation}
              onChange={() => dispatch({ type: 'SET_SHOW_ORIENTATION', show: !state.showOrientation })}
              style={{ accentColor: theme.highlight }}
            />
            Orientation
            <span style={{ color: theme.textSubtle, fontSize: 10, marginLeft: 'auto' }}>O</span>
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
              color: state.showOrientation ? theme.secondary : theme.textSubtle,
              opacity: state.showOrientation ? 1 : 0.5,
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => {
              if (state.showOrientation) (e.currentTarget as HTMLElement).style.background = theme.borderSubtle;
            }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <input
              type="radio"
              name="orientMode"
              checked={!state.autoOrientToBall}
              disabled={!state.showOrientation}
              onChange={() => dispatch({ type: 'SET_AUTO_ORIENT_TO_BALL', enabled: false })}
              style={{ accentColor: theme.highlight }}
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
              color: state.showOrientation ? theme.secondary : theme.textSubtle,
              opacity: state.showOrientation ? 1 : 0.5,
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => {
              if (state.showOrientation) (e.currentTarget as HTMLElement).style.background = theme.borderSubtle;
            }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <input
              type="radio"
              name="orientMode"
              checked={state.autoOrientToBall}
              disabled={!state.showOrientation}
              onChange={() => dispatch({ type: 'SET_AUTO_ORIENT_TO_BALL', enabled: true })}
              style={{ accentColor: theme.highlight }}
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
              color: state.showOrientation ? theme.secondary : theme.textSubtle,
              opacity: state.showOrientation ? 1 : 0.5,
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => {
              if (state.showOrientation) (e.currentTarget as HTMLElement).style.background = theme.borderSubtle;
            }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <input
              type="checkbox"
              checked={state.showCoverShadow}
              disabled={!state.showOrientation}
              onChange={() => dispatch({ type: 'SET_SHOW_COVER_SHADOW', show: !state.showCoverShadow })}
              style={{ accentColor: theme.highlight }}
            />
            Cover Shadow
            <span style={{ color: theme.textSubtle, fontSize: 10, marginLeft: 'auto' }}>C</span>
          </label>
          {/* FOV mode divider */}
          <div style={{ height: 1, background: theme.borderSubtle, margin: '4px 0' }} />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              cursor: state.showOrientation ? 'pointer' : 'not-allowed',
              fontSize: 12,
              color: state.showOrientation ? theme.secondary : theme.textSubtle,
              opacity: state.showOrientation ? 1 : 0.5,
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => {
              if (state.showOrientation) (e.currentTarget as HTMLElement).style.background = theme.borderSubtle;
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
              color: state.fovMode === 'off' ? theme.textSubtle : theme.highlight,
              fontWeight: state.fovMode === 'off' ? 400 : 600,
            }}>
              {state.fovMode === 'off' ? 'Off' : state.fovMode === 'A' ? 'My Team' : state.fovMode === 'B' ? 'Opposition' : 'Both'}
            </span>
            <span style={{ color: theme.textSubtle, fontSize: 10 }}>V</span>
          </div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 12px 4px 24px',
              cursor: state.fovMode !== 'off' ? 'pointer' : 'not-allowed',
              fontSize: 11,
              color: state.fovMode !== 'off' ? theme.secondary : theme.textSubtle,
              opacity: state.fovMode !== 'off' ? 1 : 0.5,
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => {
              if (state.fovMode !== 'off') (e.currentTarget as HTMLElement).style.background = theme.borderSubtle;
            }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <input
              type="checkbox"
              checked={state.fovExpanded}
              disabled={state.fovMode === 'off'}
              onChange={() => dispatch({ type: 'SET_FOV_EXPANDED', expanded: !state.fovExpanded })}
              style={{ accentColor: theme.highlight }}
            />
            Peripheral Vision
            <span style={{ color: theme.textSubtle, fontSize: 10, marginLeft: 'auto' }}>⇧V</span>
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
          background: theme.border,
          border: `1px solid ${theme.borderSubtle}`,
          borderRadius: 8,
          padding: '20px 24px',
          maxWidth: 380,
          width: '90%',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
        }}
      >
        <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 600, color: theme.secondary }}>
          Reset Board?
        </h3>
        <p style={{ margin: '0 0 18px', fontSize: 12, lineHeight: 1.5, color: theme.textMuted }}>
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
              border: `1px solid ${theme.borderSubtle}`,
              borderRadius: 4,
              background: 'transparent',
              color: theme.textMuted,
              cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = theme.borderSubtle; }}
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
              border: `1px solid ${theme.highlight}`,
              borderRadius: 4,
              background: hexToRgba(theme.highlight, 0.15),
              color: theme.highlight,
              cursor: 'pointer',
              fontWeight: 600,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = hexToRgba(theme.highlight, 0.3); }}
            onMouseLeave={e => { e.currentTarget.style.background = hexToRgba(theme.highlight, 0.15); }}
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
  boardsActive: boolean;
  onOpenBoards: () => void;
}

export function TopBar({ onPlayLines, onStepLines, onExportLines, showPanel, onTogglePanel, onOpenHelp, helpActive, boardsActive, onOpenBoards }: TopBarProps) {
  const { state, dispatch } = useAppState();
  const theme = useThemeColors();
  const { user, loading: authLoading } = useAuth();
  const { activeTeam } = useTeam();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [openTeamOverlay, setOpenTeamOverlay] = useState<'A' | 'B' | null>(null);
  const [openFormationDropdown, setOpenFormationDropdown] = useState<'A' | 'B' | null>(null);

  const logoSrc = user ? (state.clubIdentity.logoDataUrl || activeTeam?.logo_url) : null;

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
        background: theme.surface,
        borderBottom: `1px solid ${theme.border}`,
        height: 48,
      }}
    >
      {/* Left: Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {logoSrc && (
          <img
            src={logoSrc}
            alt="Club logo"
            style={{
              width: 36,
              height: 36,
              objectFit: 'contain',
              borderRadius: 5,
              flexShrink: 0,
              filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))',
            }}
          />
        )}
        {activeTeam && (
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: theme.secondary,
              letterSpacing: '-0.02em',
            }}
          >
            {activeTeam.name}
          </span>
        )}
        <span
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: theme.highlight,
            letterSpacing: '-0.02em',
          }}
        >
          Football Tactics Studio
        </span>
      </div>

      {/* Center: Team names + formations */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Team A: name trigger + formation trigger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <div style={{ position: 'relative' }} data-tour="team-name-a">
            <TeamNameTrigger
              name={state.teamAName}
              color={state.teamAColor}
              outlineColor={state.teamAOutlineColor}
              active={openTeamOverlay === 'A'}
              onClick={() => {
                dispatch({ type: 'SET_ACTIVE_TEAM', team: 'A' });
                setOpenFormationDropdown(null);
                setOpenTeamOverlay(prev => (prev === 'A' ? null : 'A'));
              }}
            />
            {openTeamOverlay === 'A' && (
              <TeamOverlay team="A" onClose={() => setOpenTeamOverlay(null)} />
            )}
          </div>
          <div style={{ position: 'relative' }} data-tour="formation-a">
            <button
              onClick={() => {
                dispatch({ type: 'SET_ACTIVE_TEAM', team: 'A' });
                setOpenTeamOverlay(null);
                setOpenFormationDropdown(prev => (prev === 'A' ? null : 'A'));
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: 'pointer',
                fontFamily: 'inherit',
                padding: '2px 6px',
                borderRadius: 4,
                background: openFormationDropdown === 'A' ? theme.surfaceHover : 'transparent',
                border: openFormationDropdown === 'A' ? `1px solid ${theme.borderSubtle}` : '1px solid transparent',
                transition: 'all 0.15s',
              }}
              title="Change formation"
            >
              <span style={{ fontSize: 8, color: theme.textSubtle, textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1 }}>
                Formation
              </span>
              <span style={{ fontSize: 11, color: openFormationDropdown === 'A' ? theme.highlight : theme.textMuted, lineHeight: 1.3 }}>
                {state.teamAFormation ? getFormationName(state.teamAFormation) : 'None'}
              </span>
            </button>
            {openFormationDropdown === 'A' && (
              <FormationDropdown team="A" onClose={() => setOpenFormationDropdown(null)} />
            )}
          </div>
        </div>

        <span style={{ color: theme.borderSubtle, fontSize: 13 }}>vs</span>

        {/* Team B: name trigger + formation trigger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <div style={{ position: 'relative' }}>
            <TeamNameTrigger
              name={state.teamBName}
              color={state.teamBColor}
              outlineColor={state.teamBOutlineColor}
              active={openTeamOverlay === 'B'}
              onClick={() => {
                dispatch({ type: 'SET_ACTIVE_TEAM', team: 'B' });
                setOpenFormationDropdown(null);
                setOpenTeamOverlay(prev => (prev === 'B' ? null : 'B'));
              }}
            />
            {openTeamOverlay === 'B' && (
              <TeamOverlay team="B" onClose={() => setOpenTeamOverlay(null)} />
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => {
                dispatch({ type: 'SET_ACTIVE_TEAM', team: 'B' });
                setOpenTeamOverlay(null);
                setOpenFormationDropdown(prev => (prev === 'B' ? null : 'B'));
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: 'pointer',
                fontFamily: 'inherit',
                padding: '2px 6px',
                borderRadius: 4,
                background: openFormationDropdown === 'B' ? theme.surfaceHover : 'transparent',
                border: openFormationDropdown === 'B' ? `1px solid ${theme.borderSubtle}` : '1px solid transparent',
                transition: 'all 0.15s',
              }}
              title="Change formation"
            >
              <span style={{ fontSize: 8, color: theme.textSubtle, textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1 }}>
                Formation
              </span>
              <span style={{ fontSize: 11, color: openFormationDropdown === 'B' ? theme.highlight : theme.textMuted, lineHeight: 1.3 }}>
                {state.teamBFormation ? getFormationName(state.teamBFormation) : 'None'}
              </span>
            </button>
            {openFormationDropdown === 'B' && (
              <FormationDropdown team="B" onClose={() => setOpenFormationDropdown(null)} />
            )}
          </div>
        </div>

        <button
          onClick={() => setShowResetConfirm(true)}
          style={{
            padding: '4px 12px',
            fontSize: 12,
            border: `1px solid ${theme.border}`,
            borderRadius: 4,
            background: 'transparent',
            color: theme.textMuted,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = theme.highlight;
            e.currentTarget.style.color = theme.highlight;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = theme.border;
            e.currentTarget.style.color = theme.textMuted;
          }}
        >
          Reset
        </button>
      </div>

      {/* Right: Display dropdown + Play/Export + Panel toggle */}
      <div data-tour="play-area" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {/* Display options (Orientation / Cover Shadow) */}
        <DisplayDropdown />

        {/* Play Lines / Export (conditional) */}
        {hasLineAnnotations && (
          <>
            <div style={{ width: 1, height: 18, background: theme.borderSubtle, flexShrink: 0 }} />
            <button
              onClick={() =>
                dispatch({ type: 'SET_SHOW_STEP_NUMBERS', show: !state.showStepNumbers })
              }
              title="Toggle step number badges"
              style={{
                padding: '4px 10px',
                fontSize: 11,
                fontFamily: 'inherit',
                border: state.showStepNumbers ? `1px solid ${theme.highlight}` : `1px solid ${theme.borderSubtle}`,
                borderRadius: 4,
                background: state.showStepNumbers ? hexToRgba(theme.highlight, 0.15) : 'transparent',
                color: state.showStepNumbers ? theme.highlight : theme.textMuted,
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
                border: `1px solid ${theme.borderSubtle}`,
                borderRadius: 4,
                background: 'transparent',
                color: theme.textMuted,
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
                border: `1px solid ${theme.borderSubtle}`,
                borderRadius: 4,
                background: 'transparent',
                color: theme.textMuted,
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
                border: `1px solid ${theme.borderSubtle}`,
                borderRadius: 4,
                background: 'transparent',
                color: theme.textMuted,
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
        <div style={{ width: 1, height: 18, background: theme.borderSubtle, flexShrink: 0 }} />

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
            border: helpActive ? `1px solid ${theme.highlight}` : '1px solid transparent',
            borderRadius: 4,
            background: helpActive ? hexToRgba(theme.highlight, 0.15) : 'transparent',
            color: helpActive ? theme.highlight : theme.textMuted,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            if (!helpActive) {
              e.currentTarget.style.background = theme.surfaceHover;
              e.currentTarget.style.color = theme.secondary;
            }
          }}
          onMouseLeave={e => {
            if (!helpActive) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = theme.textMuted;
            }
          }}
        >
          <HelpIcon active={helpActive} accentColor={theme.highlight} />
        </button>

        {/* Boards button */}
        <button
          onClick={onOpenBoards}
          title="Boards"
          data-tour="boards-button"
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '4px 8px',
            fontSize: 11,
            fontFamily: 'inherit',
            border: boardsActive ? `1px solid ${theme.highlight}` : '1px solid transparent',
            borderRadius: 4,
            background: boardsActive ? hexToRgba(theme.highlight, 0.15) : 'transparent',
            color: boardsActive ? theme.highlight : theme.textMuted,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            if (!boardsActive) {
              e.currentTarget.style.background = theme.surfaceHover;
              e.currentTarget.style.color = theme.secondary;
            }
          }}
          onMouseLeave={e => {
            if (!boardsActive) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = theme.textMuted;
            }
          }}
        >
          <BoardsIcon active={boardsActive} accentColor={theme.highlight} />
        </button>

        {/* Panel toggle */}
        <button
          data-tour="settings-toggle"
          onClick={onTogglePanel}
          title={showPanel ? 'Hide panel' : 'Show settings'}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '4px 8px',
            fontSize: 11,
            fontFamily: 'inherit',
            border: showPanel ? `1px solid ${theme.highlight}` : '1px solid transparent',
            borderRadius: 4,
            background: showPanel ? hexToRgba(theme.highlight, 0.15) : 'transparent',
            color: showPanel ? theme.highlight : theme.textMuted,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            if (!showPanel) {
              e.currentTarget.style.background = theme.surfaceHover;
              e.currentTarget.style.color = theme.secondary;
            }
          }}
          onMouseLeave={e => {
            if (!showPanel) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = theme.textMuted;
            }
          }}
        >
          <GearIcon active={showPanel} accentColor={theme.highlight} />
        </button>

        {/* Auth: Sign In / User menu */}
        {!authLoading && (
          <>
            <div style={{ width: 1, height: 18, background: theme.borderSubtle, flexShrink: 0 }} />
            {user ? (
              <UserMenu />
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                style={{
                  padding: '4px 12px',
                  fontSize: 11,
                  fontFamily: 'inherit',
                  border: `1px solid ${theme.borderSubtle}`,
                  borderRadius: 4,
                  background: 'transparent',
                  color: theme.textMuted,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = theme.highlight;
                  e.currentTarget.style.color = theme.highlight;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = theme.borderSubtle;
                  e.currentTarget.style.color = theme.textMuted;
                }}
              >
                Sign In
              </button>
            )}
          </>
        )}
      </div>

      {/* Reset confirmation dialog */}
      {showResetConfirm && (
        <ResetConfirmDialog
          onConfirm={() => {
            dispatch({ type: 'RESET', defaultFormationId: activeTeam?.default_formation_id });
            setShowResetConfirm(false);
          }}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}

      {/* Auth modal */}
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}
    </div>
  );
}
