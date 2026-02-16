import { useRef, useEffect } from 'react';
import { useThemeColors } from '../hooks/useThemeColors';
import { hexToRgba } from '../utils/colorUtils';

export function DeletePlayerConfirmDialog({
  playerName,
  playerNumber,
  onConfirm,
  onCancel,
}: {
  playerName: string;
  playerNumber: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
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
          Delete Player?
        </h3>
        <p style={{ margin: '0 0 18px', fontSize: 12, lineHeight: 1.5, color: '#94a3b8' }}>
          Are you sure you want to delete #{playerNumber} {playerName}? Any connected annotations
          will also be removed.
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
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
