import { useEffect, useCallback } from 'react';
import { THEME } from '../../constants/colors';
import type { Bookmark, BookmarkCategory } from '../types';
import { BOOKMARK_CATEGORY_LABELS, BOOKMARK_CATEGORY_ORDER } from '../types';

type Props = {
  existingBookmarks: Bookmark[];
  onSelect: (category: BookmarkCategory | 'custom') => void;
  onDismiss: () => void;
};

const CATEGORY_COLORS: Record<BookmarkCategory, string> = {
  kickoff: '#22c55e',
  halftime: '#f59e0b',
  start_2nd_half: '#3b82f6',
  end: '#ef4444',
};

export function BookmarkPicker({ existingBookmarks, onSelect, onDismiss }: Props) {
  const existingCategories = new Set(
    existingBookmarks.filter(b => b.category).map(b => b.category!),
  );

  const handleKey = useCallback((e: KeyboardEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (e.key === 'Escape') {
      onDismiss();
      return;
    }

    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= 4) {
      onSelect(BOOKMARK_CATEGORY_ORDER[num - 1]);
    } else if (num === 5) {
      onSelect('custom');
    }
  }, [onSelect, onDismiss]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [handleKey]);

  const options: { key: BookmarkCategory | 'custom'; num: number; label: string; color: string }[] = [
    ...BOOKMARK_CATEGORY_ORDER.map((cat, i) => ({
      key: cat,
      num: i + 1,
      label: BOOKMARK_CATEGORY_LABELS[cat].full,
      color: CATEGORY_COLORS[cat],
    })),
    { key: 'custom', num: 5, label: 'Custom', color: THEME.highlight },
  ];

  return (
    <div
      onClick={onDismiss}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 5000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.4)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'rgba(10, 10, 10, 0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 10,
          padding: '8px 0',
          width: 220,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
        }}
      >
        <div style={{
          padding: '4px 14px 8px',
          fontSize: 10,
          fontWeight: 600,
          color: THEME.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          Set bookmark
        </div>

        {options.map(opt => {
          const isSet = opt.key !== 'custom' && existingCategories.has(opt.key);
          return (
            <button
              key={opt.key}
              onClick={() => onSelect(opt.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '7px 14px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontFamily: 'inherit',
                color: THEME.secondary,
                textAlign: 'left',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = THEME.surfaceHover; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
            >
              {/* Number key hint */}
              <span style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                background: 'rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 600,
                color: THEME.textMuted,
                flexShrink: 0,
              }}>
                {opt.num}
              </span>

              {/* Color dot */}
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: opt.color,
                flexShrink: 0,
              }} />

              {/* Label */}
              <span style={{ flex: 1 }}>{opt.label}</span>

              {/* Checkmark if already set */}
              {isSet && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={opt.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          );
        })}

        <div style={{
          padding: '6px 14px 2px',
          fontSize: 9,
          color: 'rgba(255, 255, 255, 0.3)',
          textAlign: 'center',
        }}>
          Press 1-5 or click &middot; ESC to cancel
        </div>
      </div>
    </div>
  );
}
