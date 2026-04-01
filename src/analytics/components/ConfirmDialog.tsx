import { useEffect } from 'react';
import { THEME } from '../../constants/colors';

type Props = {
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({ message, confirmLabel = 'Delete', onConfirm, onCancel }: Props) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onCancel(); e.preventDefault(); e.stopPropagation(); }
      if (e.key === 'Enter') { onConfirm(); e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [onConfirm, onCancel]);

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 5000,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: THEME.surface,
          border: `1px solid ${THEME.borderSubtle}`,
          borderRadius: 10,
          padding: '20px 24px',
          maxWidth: 360,
          width: '90vw',
        }}
      >
        <div style={{
          fontSize: 14,
          color: THEME.secondary,
          lineHeight: 1.5,
          marginBottom: 18,
        }}>
          {message}
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '7px 16px',
              background: 'none',
              border: `1px solid ${THEME.borderSubtle}`,
              borderRadius: 6,
              color: THEME.textMuted,
              fontSize: 13,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            autoFocus
            onClick={onConfirm}
            style={{
              padding: '7px 16px',
              background: '#dc2626',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
