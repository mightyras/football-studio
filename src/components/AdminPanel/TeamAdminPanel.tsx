import { useState, useRef } from 'react';
import type { Team } from '../../types';
import { useAppState } from '../../state/AppStateContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import * as teamService from '../../services/teamService';

interface TeamAdminPanelProps {
  team: Team;
  onClose: () => void;
  onUpdated: () => void;
}

export function TeamAdminPanel({ team, onClose, onUpdated }: TeamAdminPanelProps) {
  const theme = useThemeColors();
  const { state } = useAppState();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(team.name);
  const [editingName, setEditingName] = useState(false);
  const [logoUrl, setLogoUrl] = useState(team.logo_url);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [playerColor, setPlayerColor] = useState(team.player_color || '');
  const [outlineColor, setOutlineColor] = useState(team.outline_color || '');
  const [savingColors, setSavingColors] = useState(false);
  // Resolve logo: prefer DB logo_url, fall back to local clubIdentity logo
  const displayLogo = logoUrl || state.clubIdentity.logoDataUrl || null;

  const smallLabelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: theme.textMuted,
    marginBottom: 6,
    display: 'block',
  };

  async function handleSaveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === team.name) {
      setName(team.name);
      setEditingName(false);
      return;
    }
    setSaving(true);
    await teamService.updateTeam(team.id, trimmed);
    setSaving(false);
    setEditingName(false);
    onUpdated();
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await teamService.uploadTeamLogo(team.id, file);
    if (url) {
      setLogoUrl(url);
      onUpdated();
    }
    setUploading(false);
    e.target.value = '';
  }

  async function handleRemoveLogo() {
    setUploading(true);
    await teamService.deleteTeamLogo(team.id);
    setLogoUrl(null);
    onUpdated();
    setUploading(false);
  }

  async function handleSaveColors() {
    setSavingColors(true);
    const updated: Record<string, string | null> = {};
    if (playerColor !== (team.player_color || '')) updated.player_color = playerColor || null;
    if (outlineColor !== (team.outline_color || '')) updated.outline_color = outlineColor || null;
    if (Object.keys(updated).length > 0) {
      await teamService.updateTeamBranding(team.id, updated);
      onUpdated();
    }
    setSavingColors(false);
  }

  const colorsChanged =
    playerColor !== (team.player_color || '') ||
    outlineColor !== (team.outline_color || '');

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2100,
      }}
      onKeyDown={e => e.stopPropagation()}
      onKeyUp={e => e.stopPropagation()}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: theme.surface,
          border: `1px solid ${theme.borderSubtle}`,
          borderRadius: 8,
          width: '90%',
          maxWidth: 400,
          maxHeight: '85vh',
          overflow: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '16px 20px',
            borderBottom: `1px solid ${theme.border}`,
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: theme.textSubtle,
              cursor: 'pointer',
              fontSize: 18,
              padding: 0,
              lineHeight: 1,
              fontFamily: 'inherit',
            }}
            title="Close"
          >
            &#x2039;
          </button>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: theme.secondary }}>
            Team Settings
          </h3>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Team Name */}
          <div>
            <span style={smallLabelStyle}>Team Name</span>
            {editingName ? (
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={e => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') { setName(team.name); setEditingName(false); }
                }}
                autoFocus
                maxLength={40}
                style={{
                  width: '100%',
                  fontSize: 14,
                  fontWeight: 600,
                  color: theme.secondary,
                  background: theme.inputBg,
                  border: `1px solid ${theme.highlight}`,
                  borderRadius: 4,
                  padding: '7px 10px',
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            ) : (
              <div
                onClick={() => setEditingName(true)}
                title="Click to edit"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  background: theme.inputBg,
                  border: `1px solid ${theme.borderSubtle}`,
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = theme.textSubtle; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = theme.borderSubtle; }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: saving ? theme.textMuted : theme.secondary }}>
                  {saving ? 'Saving\u2026' : name}
                </span>
                <span style={{ fontSize: 10, color: theme.textSubtle }}>edit</span>
              </div>
            )}
          </div>

          {/* Team Logo */}
          <div>
            <span style={smallLabelStyle}>Team Logo</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {/* Logo preview */}
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 8,
                  background: theme.inputBg,
                  border: `1px solid ${theme.borderSubtle}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                {displayLogo ? (
                  <img
                    src={displayLogo}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <span style={{ fontSize: 28, color: theme.textSubtle }}>
                    {team.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Upload / Remove buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  style={{
                    fontSize: 11,
                    fontFamily: 'inherit',
                    padding: '5px 14px',
                    border: `1px solid ${theme.borderSubtle}`,
                    borderRadius: 4,
                    background: 'transparent',
                    color: theme.textMuted,
                    cursor: uploading ? 'wait' : 'pointer',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = theme.textSubtle; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = theme.borderSubtle; }}
                >
                  {uploading ? 'Uploading\u2026' : displayLogo ? 'Change Logo' : 'Upload Logo'}
                </button>
                {displayLogo && (
                  <button
                    onClick={handleRemoveLogo}
                    disabled={uploading}
                    style={{
                      fontSize: 11,
                      fontFamily: 'inherit',
                      padding: '5px 14px',
                      border: `1px solid ${theme.borderSubtle}`,
                      borderRadius: 4,
                      background: 'transparent',
                      color: '#ef4444',
                      cursor: uploading ? 'wait' : 'pointer',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = theme.borderSubtle; }}
                  >
                    Remove
                  </button>
                )}
                <span style={{ fontSize: 10, color: theme.textSubtle }}>
                  PNG, JPEG, SVG, WebP
                </span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={handleLogoUpload}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          {/* Team Colors */}
          <div>
            <span style={smallLabelStyle}>Team Colors</span>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 6 }}>Player Color</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 4,
                      background: /^#[0-9a-fA-F]{6}$/.test(playerColor) ? playerColor : '#e74c3c',
                      border: `1px solid ${theme.borderSubtle}`,
                      flexShrink: 0,
                    }}
                  />
                  <input
                    type="text"
                    value={playerColor || '#e74c3c'}
                    onChange={e => setPlayerColor(e.target.value)}
                    placeholder="#e74c3c"
                    maxLength={7}
                    style={{
                      padding: '7px 10px',
                      fontSize: 12,
                      fontFamily: 'inherit',
                      background: theme.inputBg,
                      border: `1px solid ${theme.borderSubtle}`,
                      borderRadius: 4,
                      color: theme.secondary,
                      outline: 'none',
                      width: '100%',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = theme.highlight; }}
                    onBlur={e => { e.currentTarget.style.borderColor = theme.borderSubtle; }}
                  />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 6 }}>Outline Color</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 4,
                      background: /^#[0-9a-fA-F]{6}$/.test(outlineColor) ? outlineColor : '#1a1a2e',
                      border: `1px solid ${theme.borderSubtle}`,
                      flexShrink: 0,
                    }}
                  />
                  <input
                    type="text"
                    value={outlineColor || '#1a1a2e'}
                    onChange={e => setOutlineColor(e.target.value)}
                    placeholder="#1a1a2e"
                    maxLength={7}
                    style={{
                      padding: '7px 10px',
                      fontSize: 12,
                      fontFamily: 'inherit',
                      background: theme.inputBg,
                      border: `1px solid ${theme.borderSubtle}`,
                      borderRadius: 4,
                      color: theme.secondary,
                      outline: 'none',
                      width: '100%',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = theme.highlight; }}
                    onBlur={e => { e.currentTarget.style.borderColor = theme.borderSubtle; }}
                  />
                </div>
              </div>
            </div>
            {colorsChanged && (
              <button
                onClick={handleSaveColors}
                disabled={savingColors}
                style={{
                  marginTop: 10,
                  padding: '6px 14px',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  border: `1px solid ${theme.highlight}`,
                  borderRadius: 4,
                  background: 'rgba(245, 158, 11, 0.15)',
                  color: theme.highlight,
                  fontWeight: 600,
                  cursor: savingColors ? 'wait' : 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245, 158, 11, 0.3)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(245, 158, 11, 0.15)'; }}
              >
                {savingColors ? 'Saving…' : 'Save Colors'}
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
