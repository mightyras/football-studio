import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppState } from '../../state/AppStateContext';
import { extractSceneData } from '../../state/AppStateContext';
import { loadScenes, addScene, deleteScene, renameScene } from '../../utils/sceneStorage';
import { generateThumbnail, renderSceneToBlob } from '../../utils/sceneRenderer';
import { useThemeColors } from '../../hooks/useThemeColors';
import { hexToRgba } from '../../utils/colorUtils';
import { useAuth } from '../../state/AuthContext';
import { useTeam } from '../../state/TeamContext';
import * as boardService from '../../services/boardService';
import type { SavedScene, BoardsTab } from '../../types';

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
  const theme = useThemeColors();
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
        color: danger ? '#ef4444' : theme.textSubtle,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = danger ? 'rgba(239, 68, 68, 0.15)' : theme.surfaceHover;
        e.currentTarget.style.color = danger ? '#ef4444' : theme.secondary;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = danger ? '#ef4444' : theme.textSubtle;
      }}
    >
      {children}
    </button>
  );
}

// ── Extended scene type with owner info ──

type BoardScene = SavedScene & {
  ownerId?: string;
  ownerName?: string | null;
};

// ── Scene card ──

function SceneCard({
  scene,
  onLoad,
  onDelete,
  onRename,
  isOwner,
  showOwner,
}: {
  scene: BoardScene;
  onLoad: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
  isOwner: boolean;
  showOwner?: boolean;
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
        borderBottom: `1px solid ${theme.border}`,
        cursor: editing || confirmDelete ? 'default' : 'pointer',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { if (!editing) e.currentTarget.style.background = theme.surfaceHover; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; setConfirmDelete(false); }}
    >
      {/* Thumbnail */}
      {scene.thumbnail && (
        <img
          src={scene.thumbnail}
          alt={scene.name}
          style={{
            width: 60,
            height: 38,
            borderRadius: 3,
            border: `1px solid ${theme.border}`,
            objectFit: 'cover',
            flexShrink: 0,
          }}
        />
      )}

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
              color: theme.secondary,
              background: theme.inputBg,
              border: `1px solid ${theme.highlight}`,
              borderRadius: 3,
              padding: '1px 4px',
              outline: 'none',
              width: '100%',
            }}
          />
        ) : (
          <div
            onDoubleClick={e => {
              if (!isOwner) return;
              e.stopPropagation();
              setEditing(true);
              setEditName(scene.name);
            }}
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: theme.secondary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {scene.name}
          </div>
        )}
        <div style={{ fontSize: 9, color: theme.textSubtle }}>
          {timeAgo(scene.savedAt)}
          {showOwner && scene.ownerName && (
            <span style={{ marginLeft: 4 }}>
              &middot; by {scene.ownerName}
            </span>
          )}
        </div>
      </div>

      {/* Actions — only for board owner */}
      {isOwner && (
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
              title="Delete board"
              danger
            >
              <TrashIcon />
            </IconButton>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main panel ──

interface ScenesPanelProps {
  saveRequested?: boolean;
  onSaveHandled?: () => void;
  onRequestSignIn?: () => void;
}

/** Convert a Supabase BoardRow to a BoardScene for the UI. */
function boardRowToScene(row: boardService.BoardRow): BoardScene {
  return {
    id: row.id,
    name: row.name,
    savedAt: new Date(row.updated_at).getTime(),
    thumbnail: row.thumbnail_url ?? '',
    data: row.data,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
  };
}

export function ScenesPanel({ saveRequested, onSaveHandled, onRequestSignIn }: ScenesPanelProps) {
  const { state, dispatch } = useAppState();
  const theme = useThemeColors();
  const { user } = useAuth();
  const { activeTeam } = useTeam();
  const isCloud = !!user;
  const hasTeam = !!activeTeam;

  const [boardsTab, setBoardsTab] = useState<BoardsTab>('my');
  const [myScenes, setMyScenes] = useState<BoardScene[]>(() => (isCloud ? [] : loadScenes()));
  const [teamScenes, setTeamScenes] = useState<BoardScene[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [migrationPrompt, setMigrationPrompt] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const showFeedback = useCallback((msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2000);
  }, []);

  // Fetch personal boards from Supabase when user is authenticated
  useEffect(() => {
    if (!isCloud) {
      setMyScenes(loadScenes());
      return;
    }
    setLoading(true);
    boardService.fetchMyBoards()
      .then(rows => setMyScenes(rows.map(boardRowToScene)))
      .catch(() => showFeedback('Failed to load boards'))
      .finally(() => setLoading(false));
  }, [isCloud, showFeedback]);

  // Fetch team boards when team changes or team tab is selected
  useEffect(() => {
    if (!isCloud || !activeTeam) {
      setTeamScenes([]);
      return;
    }
    setLoading(true);
    boardService.fetchTeamBoards(activeTeam.id)
      .then(rows => setTeamScenes(rows.map(boardRowToScene)))
      .catch(() => showFeedback('Failed to load team boards'))
      .finally(() => setLoading(false));
  }, [isCloud, activeTeam?.id, showFeedback]); // eslint-disable-line react-hooks/exhaustive-deps

  // Switch to "my" tab if user loses their team
  useEffect(() => {
    if (!hasTeam && boardsTab === 'team') setBoardsTab('my');
  }, [hasTeam, boardsTab]);

  // Check for localStorage boards to migrate on first cloud login
  useEffect(() => {
    if (!user) return;
    const migrationKey = `football-studio-migrated-${user.id}`;
    if (localStorage.getItem(migrationKey)) return;
    const local = loadScenes();
    if (local.length > 0) setMigrationPrompt(true);
  }, [user]);

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
    if (!user) {
      onRequestSignIn?.();
      return;
    }
    setSaveName(`${state.teamAName} vs ${state.teamBName}`);
    setSaving(true);
  };

  const confirmSave = async () => {
    const name = saveName.trim() || `${state.teamAName} vs ${state.teamBName}`;
    const thumbnail = generateThumbnail(state);
    const data = extractSceneData(state);

    if (isCloud) {
      setSaving(false);
      const teamId = boardsTab === 'team' && activeTeam ? activeTeam.id : undefined;
      const row = await boardService.createBoard(name, data, thumbnail, teamId);
      if (row) {
        const scene = boardRowToScene(row);
        // Also set owner name from current user for immediate display
        if (user) scene.ownerName = user.user_metadata?.display_name || user.email || null;
        if (boardsTab === 'team') {
          setTeamScenes(prev => [scene, ...prev]);
        } else {
          setMyScenes(prev => [scene, ...prev]);
        }
        showFeedback('Saved!');
      } else {
        showFeedback('Save failed');
      }
    } else {
      const scene: BoardScene = {
        id: `scene-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        savedAt: Date.now(),
        thumbnail,
        data,
      };
      const updated = addScene(scene);
      setMyScenes(updated);
      setSaving(false);
      showFeedback('Saved!');
    }
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

  const handleLoad = (scene: BoardScene) => {
    dispatch({ type: 'LOAD_SCENE', data: scene.data });
  };

  const handleDelete = async (id: string) => {
    if (isCloud) {
      if (boardsTab === 'team') {
        setTeamScenes(prev => prev.filter(s => s.id !== id));
      } else {
        setMyScenes(prev => prev.filter(s => s.id !== id));
      }
      const ok = await boardService.deleteBoard(id);
      if (!ok) showFeedback('Delete failed');
    } else {
      setMyScenes(deleteScene(id));
    }
  };

  const handleRename = async (id: string, name: string) => {
    if (isCloud) {
      const update = (s: BoardScene) => s.id === id ? { ...s, name } : s;
      if (boardsTab === 'team') {
        setTeamScenes(prev => prev.map(update));
      } else {
        setMyScenes(prev => prev.map(update));
      }
      const ok = await boardService.renameBoard(id, name);
      if (!ok) showFeedback('Rename failed');
    } else {
      setMyScenes(renameScene(id, name));
    }
  };

  const handleMigrate = async () => {
    if (!user) return;
    setMigrating(true);
    const local = loadScenes();
    let ok = true;
    for (const scene of local) {
      const row = await boardService.createBoard(scene.name, scene.data, scene.thumbnail);
      if (!row) { ok = false; break; }
    }
    if (ok) {
      localStorage.setItem(`football-studio-migrated-${user.id}`, 'true');
      setMigrationPrompt(false);
      // Refresh from cloud
      const rows = await boardService.fetchMyBoards();
      setMyScenes(rows.map(boardRowToScene));
      showFeedback(`Imported ${local.length} boards!`);
    } else {
      showFeedback('Migration failed — some boards were not imported');
    }
    setMigrating(false);
  };

  const displayedScenes = boardsTab === 'my' ? myScenes : teamScenes;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Sub-tab bar: My Boards / Team Boards */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${theme.border}`, flexShrink: 0 }}>
        <button
          onClick={() => setBoardsTab('my')}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '8px 4px',
            fontSize: 11,
            fontWeight: 600,
            fontFamily: 'inherit',
            letterSpacing: '0.03em',
            textTransform: 'uppercase' as const,
            border: 'none',
            borderBottom: boardsTab === 'my' ? `2px solid ${theme.highlight}` : '2px solid transparent',
            background: 'transparent',
            color: boardsTab === 'my' ? theme.highlight : theme.textMuted,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          My Boards
        </button>
        {hasTeam && (
          <button
            onClick={() => setBoardsTab('team')}
            style={{
              flex: 1,
              minWidth: 0,
              padding: '8px 4px',
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'inherit',
              letterSpacing: '0.03em',
              textTransform: 'uppercase' as const,
              border: 'none',
              borderBottom: boardsTab === 'team' ? `2px solid ${theme.highlight}` : '2px solid transparent',
              background: 'transparent',
              color: boardsTab === 'team' ? theme.highlight : theme.textMuted,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            Team Boards
          </button>
        )}
      </div>

      {/* Action bar */}
      <div style={{ padding: '10px 10px 8px', borderBottom: `1px solid ${theme.border}`, flexShrink: 0 }}>
        {/* Save button */}
        {user ? (
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
              border: `1px solid ${theme.highlight}`,
              borderRadius: 4,
              background: hexToRgba(theme.highlight, 0.1),
              color: theme.highlight,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = hexToRgba(theme.highlight, 0.2); }}
            onMouseLeave={e => { e.currentTarget.style.background = hexToRgba(theme.highlight, 0.1); }}
          >
            <SaveIcon />
            {boardsTab === 'team' ? 'Save to Team' : 'Save Board'}
          </button>
        ) : (
          <button
            onClick={() => onRequestSignIn?.()}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              width: '100%',
              padding: '6px 0',
              fontSize: 11,
              fontWeight: 500,
              fontFamily: 'inherit',
              border: `1px solid ${theme.borderSubtle}`,
              borderRadius: 4,
              background: 'transparent',
              color: theme.textSubtle,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = theme.textSubtle; e.currentTarget.style.color = theme.textMuted; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = theme.borderSubtle; e.currentTarget.style.color = theme.textSubtle; }}
          >
            <SaveIcon />
            Sign in to save boards
          </button>
        )}

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
              placeholder="Board name..."
              style={{
                flex: 1,
                fontSize: 11,
                fontFamily: 'inherit',
                padding: '4px 6px',
                border: `1px solid ${theme.borderSubtle}`,
                borderRadius: 3,
                background: theme.inputBg,
                color: theme.secondary,
                outline: 'none',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = theme.highlight; }}
              onBlur={e => { e.currentTarget.style.borderColor = theme.borderSubtle; }}
            />
            <button
              onClick={confirmSave}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '4px 8px',
                fontSize: 10,
                fontFamily: 'inherit',
                border: `1px solid ${theme.highlight}`,
                borderRadius: 3,
                background: hexToRgba(theme.highlight, 0.15),
                color: theme.highlight,
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
              border: `1px solid ${theme.borderSubtle}`,
              borderRadius: 3,
              background: 'transparent',
              color: theme.textMuted,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = theme.highlight; e.currentTarget.style.color = theme.highlight; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = theme.borderSubtle; e.currentTarget.style.color = theme.textMuted; }}
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
              border: `1px solid ${theme.borderSubtle}`,
              borderRadius: 3,
              background: 'transparent',
              color: theme.textMuted,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = theme.highlight; e.currentTarget.style.color = theme.highlight; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = theme.borderSubtle; e.currentTarget.style.color = theme.textMuted; }}
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

      {/* Migration prompt */}
      {migrationPrompt && boardsTab === 'my' && (
        <div style={{
          padding: '8px 10px',
          borderBottom: `1px solid ${theme.border}`,
          background: hexToRgba(theme.highlight, 0.05),
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 11, color: theme.secondary, marginBottom: 6 }}>
            You have {loadScenes().length} locally saved board(s). Import them to your account?
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={handleMigrate}
              disabled={migrating}
              style={{
                padding: '4px 12px',
                fontSize: 10,
                fontFamily: 'inherit',
                fontWeight: 600,
                border: `1px solid ${theme.highlight}`,
                borderRadius: 3,
                background: hexToRgba(theme.highlight, 0.15),
                color: theme.highlight,
                cursor: migrating ? 'wait' : 'pointer',
              }}
            >
              {migrating ? 'Importing...' : 'Import'}
            </button>
            <button
              onClick={() => {
                if (user) localStorage.setItem(`football-studio-migrated-${user.id}`, 'true');
                setMigrationPrompt(false);
              }}
              style={{
                padding: '4px 12px',
                fontSize: 10,
                fontFamily: 'inherit',
                border: `1px solid ${theme.borderSubtle}`,
                borderRadius: 3,
                background: 'transparent',
                color: theme.textMuted,
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Board list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{
            padding: '24px 16px',
            textAlign: 'center',
            color: theme.textSubtle,
            fontSize: 11,
          }}>
            Loading boards...
          </div>
        ) : displayedScenes.length === 0 ? (
          <div style={{
            padding: '24px 16px',
            textAlign: 'center',
            color: theme.textSubtle,
            fontSize: 11,
            lineHeight: 1.5,
          }}>
            {boardsTab === 'team'
              ? 'No team boards yet.'
              : 'No saved boards yet.'}
            <br />
            <span style={{ fontSize: 10, color: '#4b5563' }}>
              {boardsTab === 'team'
                ? 'Save your current board to the team to get started.'
                : 'Save your current board to get started.'}
            </span>
          </div>
        ) : (
          displayedScenes.map(scene => (
            <SceneCard
              key={scene.id}
              scene={scene}
              onLoad={() => handleLoad(scene)}
              onDelete={() => handleDelete(scene.id)}
              onRename={name => handleRename(scene.id, name)}
              isOwner={!scene.ownerId || scene.ownerId === user?.id}
              showOwner={boardsTab === 'team'}
            />
          ))
        )}
      </div>
    </div>
  );
}
