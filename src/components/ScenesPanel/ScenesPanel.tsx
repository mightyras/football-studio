import { useState, useEffect, useRef } from 'react';
import { useAppState } from '../../state/AppStateContext';
import { extractSceneData } from '../../state/AppStateContext';
import { loadScenes, addScene, deleteScene, renameScene } from '../../utils/sceneStorage';
import { generateThumbnail, renderSceneToBlob } from '../../utils/sceneRenderer';
import { useThemeColors } from '../../hooks/useThemeColors';
import { hexToRgba } from '../../utils/colorUtils';
import type { SavedScene } from '../../types';

// ── Icons ──

const SaveIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

const CopyIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const TrashIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </svg>
);

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// ── Relative time helper ──

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

// ── Small action button ──

function IconButton({
  onClick,
  title,
  children,
  danger,
}: {
  onClick: (e: React.MouseEvent) => void;
  title: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 24,
        height: 24,
        border: 'none',
        borderRadius: 3,
        background: 'transparent',
        color: danger ? '#ef4444' : '#64748b',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = danger ? 'rgba(239, 68, 68, 0.15)' : '#1f2937';
        e.currentTarget.style.color = danger ? '#ef4444' : '#e2e8f0';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = danger ? '#ef4444' : '#64748b';
      }}
    >
      {children}
    </button>
  );
}

// ── Scene card ──

function SceneCard({
  scene,
  onLoad,
  onDelete,
  onRename,
}: {
  scene: SavedScene;
  onLoad: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}) {
  const theme = useThemeColors();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(scene.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commitRename = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== scene.name) {
      onRename(trimmed);
    }
    setEditing(false);
  };

  return (
    <div
      onClick={() => { if (!editing && !confirmDelete) onLoad(); }}
      style={{
        display: 'flex',
        gap: 8,
        padding: '8px 10px',
        borderBottom: '1px solid #1e293b',
        cursor: editing || confirmDelete ? 'default' : 'pointer',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { if (!editing) e.currentTarget.style.background = '#1f2937'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; setConfirmDelete(false); }}
    >
      {/* Thumbnail */}
      <img
        src={scene.thumbnail}
        alt={scene.name}
        style={{
          width: 60,
          height: 38,
          borderRadius: 3,
          border: '1px solid #1e293b',
          objectFit: 'cover',
          flexShrink: 0,
        }}
      />

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
        {editing ? (
          <input
            ref={inputRef}
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') { setEditing(false); setEditName(scene.name); }
              e.stopPropagation();
            }}
            onBlur={commitRename}
            onClick={e => e.stopPropagation()}
            style={{
              fontSize: 11,
              fontFamily: 'inherit',
              fontWeight: 600,
              color: '#e2e8f0',
              background: '#0f172a',
              border: `1px solid ${theme.accent}`,
              borderRadius: 3,
              padding: '1px 4px',
              outline: 'none',
              width: '100%',
            }}
          />
        ) : (
          <div
            onDoubleClick={e => { e.stopPropagation(); setEditing(true); setEditName(scene.name); }}
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#e2e8f0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {scene.name}
          </div>
        )}
        <div style={{ fontSize: 9, color: '#64748b' }}>
          {timeAgo(scene.savedAt)}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        {confirmDelete ? (
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            style={{
              fontSize: 9,
              fontFamily: 'inherit',
              padding: '2px 6px',
              border: '1px solid #ef4444',
              borderRadius: 3,
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              cursor: 'pointer',
            }}
          >
            Delete?
          </button>
        ) : (
          <IconButton
            onClick={e => { e.stopPropagation(); setConfirmDelete(true); }}
            title="Delete scene"
            danger
          >
            <TrashIcon />
          </IconButton>
        )}
      </div>
    </div>
  );
}

// ── Main panel ──

interface ScenesPanelProps {
  saveRequested?: boolean;
  onSaveHandled?: () => void;
}

export function ScenesPanel({ saveRequested, onSaveHandled }: ScenesPanelProps) {
  const { state, dispatch } = useAppState();
  const theme = useThemeColors();
  const [scenes, setScenes] = useState<SavedScene[]>(() => loadScenes());
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Respond to external save trigger (Cmd+S)
  useEffect(() => {
    if (saveRequested) {
      startSaving();
      onSaveHandled?.();
    }
  }, [saveRequested]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (saving && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [saving]);

  const startSaving = () => {
    setSaveName(`${state.teamAName} vs ${state.teamBName}`);
    setSaving(true);
  };

  const confirmSave = () => {
    const name = saveName.trim() || `${state.teamAName} vs ${state.teamBName}`;
    const thumbnail = generateThumbnail(state);
    const data = extractSceneData(state);
    const scene: SavedScene = {
      id: `scene-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      savedAt: Date.now(),
      thumbnail,
      data,
    };
    const updated = addScene(scene);
    setScenes(updated);
    setSaving(false);
    showFeedback('Saved!');
  };

  const handleExportPNG = async () => {
    const blob = await renderSceneToBlob(state);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.teamAName}-vs-${state.teamBName}.png`.replace(/[^a-zA-Z0-9_.-]/g, '_');
    a.click();
    URL.revokeObjectURL(url);
    showFeedback('Exported!');
  };

  const handleCopyClipboard = async () => {
    try {
      const blob = await renderSceneToBlob(state);
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      showFeedback('Copied!');
    } catch {
      showFeedback('Copy failed');
    }
  };

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2000);
  };

  const handleLoad = (scene: SavedScene) => {
    dispatch({ type: 'LOAD_SCENE', data: scene.data });
  };

  const handleDelete = (id: string) => {
    setScenes(deleteScene(id));
  };

  const handleRename = (id: string, name: string) => {
    setScenes(renameScene(id, name));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Action bar */}
      <div style={{ padding: '10px 10px 8px', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
        {/* Save button */}
        <button
          onClick={startSaving}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            width: '100%',
            padding: '6px 0',
            fontSize: 11,
            fontWeight: 600,
            fontFamily: 'inherit',
            border: `1px solid ${theme.accent}`,
            borderRadius: 4,
            background: hexToRgba(theme.accent, 0.1),
            color: theme.accent,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = hexToRgba(theme.accent, 0.2); }}
          onMouseLeave={e => { e.currentTarget.style.background = hexToRgba(theme.accent, 0.1); }}
        >
          <SaveIcon />
          Save Scene
        </button>

        {/* Inline name input (shown when saving) */}
        {saving && (
          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            <input
              ref={nameInputRef}
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') confirmSave();
                if (e.key === 'Escape') setSaving(false);
                e.stopPropagation();
              }}
              placeholder="Scene name..."
              style={{
                flex: 1,
                fontSize: 11,
                fontFamily: 'inherit',
                padding: '4px 6px',
                border: '1px solid #374151',
                borderRadius: 3,
                background: '#0f172a',
                color: '#e2e8f0',
                outline: 'none',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = theme.accent; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#374151'; }}
            />
            <button
              onClick={confirmSave}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '4px 8px',
                fontSize: 10,
                fontFamily: 'inherit',
                border: `1px solid ${theme.accent}`,
                borderRadius: 3,
                background: hexToRgba(theme.accent, 0.15),
                color: theme.accent,
                cursor: 'pointer',
              }}
            >
              <CheckIcon />
            </button>
          </div>
        )}

        {/* Export / Copy row */}
        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          <button
            onClick={handleCopyClipboard}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              padding: '5px 0',
              fontSize: 10,
              fontFamily: 'inherit',
              border: '1px solid #374151',
              borderRadius: 3,
              background: 'transparent',
              color: '#94a3b8',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = theme.accent; e.currentTarget.style.color = theme.accent; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#374151'; e.currentTarget.style.color = '#94a3b8'; }}
          >
            <CopyIcon />
            Copy
          </button>
          <button
            onClick={handleExportPNG}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              padding: '5px 0',
              fontSize: 10,
              fontFamily: 'inherit',
              border: '1px solid #374151',
              borderRadius: 3,
              background: 'transparent',
              color: '#94a3b8',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = theme.accent; e.currentTarget.style.color = theme.accent; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#374151'; e.currentTarget.style.color = '#94a3b8'; }}
          >
            <DownloadIcon />
            Export PNG
          </button>
        </div>

        {/* Feedback toast */}
        {feedback && (
          <div style={{
            marginTop: 6,
            padding: '3px 0',
            fontSize: 10,
            fontWeight: 600,
            color: '#22c55e',
            textAlign: 'center',
            transition: 'opacity 0.3s',
          }}>
            {feedback}
          </div>
        )}
      </div>

      {/* Scene list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {scenes.length === 0 ? (
          <div style={{
            padding: '24px 16px',
            textAlign: 'center',
            color: '#64748b',
            fontSize: 11,
            lineHeight: 1.5,
          }}>
            No saved scenes yet.
            <br />
            <span style={{ fontSize: 10, color: '#4b5563' }}>
              Save your current board to get started.
            </span>
          </div>
        ) : (
          scenes.map(scene => (
            <SceneCard
              key={scene.id}
              scene={scene}
              onLoad={() => handleLoad(scene)}
              onDelete={() => handleDelete(scene.id)}
              onRename={name => handleRename(scene.id, name)}
            />
          ))
        )}
      </div>
    </div>
  );
}
