import { useState, useEffect, useCallback } from 'react';
import { useAppState } from '../../state/AppStateContext';
import { useTeam } from '../../state/TeamContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import { hexToRgba } from '../../utils/colorUtils';
import * as matchPlanService from '../../services/matchPlanService';
import type { MatchPlanRow } from '../../services/matchPlanService';

interface MatchPlansBrowserProps {
  onClose: () => void;
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function MatchPlansBrowser({ onClose }: MatchPlansBrowserProps) {
  const { state, dispatch } = useAppState();
  const { activeTeam } = useTeam();
  const theme = useThemeColors();

  const hasTeam = !!activeTeam;

  const [tab, setTab] = useState<'my' | 'team'>('my');
  const [plans, setPlans] = useState<MatchPlanRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    if (tab === 'my') {
      const result = await matchPlanService.fetchMyMatchPlans();
      setPlans(result);
    } else if (tab === 'team' && activeTeam) {
      const result = await matchPlanService.fetchTeamMatchPlans(activeTeam.id);
      setPlans(result);
    }
    setLoading(false);
  }, [tab, activeTeam]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleLoad = (row: MatchPlanRow) => {
    dispatch({
      type: 'LOAD_MATCH_PLAN',
      plan: row.data,
      cloudId: row.id,
    });
    onClose();
  };

  const handleDelete = async (id: string) => {
    await matchPlanService.deleteMatchPlan(id);
    setPlans(prev => prev.filter(p => p.id !== id));
    setConfirmDeleteId(null);

    // If the deleted match is the currently active one, clear it and go back to landing
    if (id === state.matchPlanCloudId) {
      dispatch({ type: 'CLEAR_MATCH_PLAN' });
      onClose();
    }
  };

  const handleRename = async (id: string, newName: string) => {
    await matchPlanService.renameMatchPlan(id, newName);
    setPlans(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p));
    setEditingId(null);
  };

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
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: 8,
          width: 440,
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: `1px solid ${theme.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: theme.secondary }}>
            Match Plans
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: theme.textSubtle,
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        {hasTeam && (
          <div
            style={{
              display: 'flex',
              borderBottom: `1px solid ${theme.border}`,
              flexShrink: 0,
            }}
          >
            {(['my', 'team'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: tab === t ? `2px solid ${theme.highlight}` : '2px solid transparent',
                  color: tab === t ? theme.highlight : theme.textMuted,
                  cursor: 'pointer',
                }}
              >
                {t === 'my' ? 'My Plans' : 'Team'}
              </button>
            ))}
          </div>
        )}

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {loading && (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: theme.textSubtle }}>
              Loading...
            </div>
          )}

          {!loading && plans.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: theme.textSubtle }}>
              No saved match plans yet.
            </div>
          )}

          {!loading && plans.map(item => (
            <div
              key={item.id}
              onClick={() => {
                if (editingId || confirmDeleteId) return;
                handleLoad(item);
              }}
              style={{
                padding: '12px 20px',
                borderBottom: `1px solid ${theme.borderSubtle}`,
                cursor: editingId || confirmDeleteId ? 'default' : 'pointer',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => {
                if (!editingId && !confirmDeleteId) {
                  e.currentTarget.style.background = hexToRgba(theme.highlight, 0.05);
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Color dots */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <div style={{
                    width: 12, height: 12, borderRadius: '50%',
                    background: item.board_context?.teamAColor ?? '#3b82f6',
                    border: '1px solid rgba(255,255,255,0.2)',
                  }} />
                  <div style={{
                    width: 12, height: 12, borderRadius: '50%',
                    background: item.board_context?.teamBColor ?? '#ef4444',
                    border: '1px solid rgba(255,255,255,0.2)',
                  }} />
                </div>

                {/* Name */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editingId === item.id ? (
                    <input
                      type="text"
                      autoFocus
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onClick={e => e.stopPropagation()}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          handleRename(item.id, editingName);
                        } else if (e.key === 'Escape') {
                          setEditingId(null);
                        }
                      }}
                      onBlur={() => handleRename(item.id, editingName)}
                      style={{
                        width: '100%',
                        padding: '2px 6px',
                        fontSize: 13,
                        fontFamily: 'inherit',
                        background: hexToRgba(theme.secondary, 0.1),
                        border: `1px solid ${theme.borderSubtle}`,
                        borderRadius: 3,
                        color: theme.secondary,
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  ) : (
                    <div
                      onDoubleClick={e => {
                        e.stopPropagation();
                        setEditingId(item.id);
                        setEditingName(item.name);
                      }}
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: theme.secondary,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title="Double-click to rename"
                    >
                      {item.name}
                    </div>
                  )}
                </div>

                {/* Time */}
                <span style={{ fontSize: 12, color: theme.textMuted, flexShrink: 0 }}>
                  {timeAgo(new Date(item.updated_at).getTime())}
                </span>

                {/* Delete */}
                {confirmDeleteId === item.id ? (
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => handleDelete(item.id)}
                      style={{
                        fontSize: 12,
                        fontFamily: 'inherit',
                        padding: '3px 8px',
                        border: `1px solid #ef4444`,
                        borderRadius: 3,
                        background: 'rgba(239,68,68,0.15)',
                        color: '#ef4444',
                        cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      style={{
                        fontSize: 12,
                        fontFamily: 'inherit',
                        padding: '3px 8px',
                        border: `1px solid ${theme.borderSubtle}`,
                        borderRadius: 3,
                        background: 'transparent',
                        color: theme.textMuted,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setConfirmDeleteId(item.id);
                    }}
                    title="Delete"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: theme.textMuted,
                      cursor: 'pointer',
                      fontSize: 16,
                      padding: '0 4px',
                      flexShrink: 0,
                      opacity: 0.6,
                    }}
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Subtitle */}
              <div style={{ display: 'flex', gap: 8, marginTop: 6, paddingLeft: 29, fontSize: 12, color: theme.textMuted }}>
                <span>{item.board_context?.teamAName ?? '?'} vs {item.board_context?.teamBName ?? '?'}</span>
                <span>{item.board_context?.eventCount ?? 0} event{(item.board_context?.eventCount ?? 0) !== 1 ? 's' : ''}</span>
                {item.board_context?.ruleMode && (
                  <span style={{
                    padding: '0 4px',
                    borderRadius: 2,
                    background: hexToRgba(theme.highlight, 0.1),
                    color: theme.highlight,
                  }}>
                    {item.board_context.ruleMode === 'fifa-standard' ? 'FIFA' : 'Free'}
                  </span>
                )}
                {item.owner_name && tab === 'team' && (
                  <span>{item.owner_name}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
