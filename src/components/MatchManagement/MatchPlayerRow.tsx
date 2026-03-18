import { useState } from 'react';
import { useThemeColors } from '../../hooks/useThemeColors';
import { hexToRgba } from '../../utils/colorUtils';
import type { PositionRole } from '../../types';
import { ROLE_LABELS } from '../../types';

interface MatchPlayerRowProps {
  number: number;
  name: string;
  role: PositionRole;
  minutesPlayed: number;
  totalMinutes: number;
  positionHistory: Array<{ role: PositionRole; from: number; to: number }>;
  isOnPitch: boolean;
  teamColor: string;
  subMinute?: number;
  /** Enable inline editing of name/number (minute 0 only) */
  editable?: boolean;
  onEdit?: (field: 'number' | 'name', value: string) => void;
  /** Brief flash animation after swap */
  flash?: boolean;
  /** Drag-and-drop props */
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

export function MatchPlayerRow({
  number,
  name,
  role: _role,
  minutesPlayed,
  totalMinutes,
  positionHistory,
  isOnPitch,
  teamColor,
  subMinute,
  flash,
  editable,
  onEdit,
  draggable: isDraggable,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: MatchPlayerRowProps) {
  const theme = useThemeColors();
  const barWidth = totalMinutes > 0 ? (minutesPlayed / totalMinutes) * 100 : 0;
  const [editing, setEditing] = useState<'number' | 'name' | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Get unique positions played
  const positions = [...new Set(positionHistory.map(h => h.role))];

  return (
    <div
      draggable={isDraggable && !editing}
      onDragStart={onDragStart}
      onDragOver={e => {
        if (onDragOver) {
          onDragOver(e);
          setIsDragOver(true);
        }
      }}
      onDragLeave={e => {
        if (onDragLeave) {
          onDragLeave(e);
          setIsDragOver(false);
        }
      }}
      onDrop={e => {
        setIsDragOver(false);
        if (onDrop) onDrop(e);
      }}
      onDragEnd={e => { setIsDragOver(false); if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = '1'; }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: isDraggable ? '6px 10px' : '5px 12px',
        margin: isDraggable ? '3px 8px' : undefined,
        opacity: 1,
        cursor: isDraggable && !editing ? 'grab' : undefined,
        background: flash
          ? hexToRgba(theme.highlight, 0.15)
          : isDragOver
            ? hexToRgba(theme.highlight, 0.08)
            : isDraggable
              ? hexToRgba(theme.secondary, 0.04)
              : undefined,
        border: flash
          ? `1px solid ${hexToRgba(theme.highlight, 0.5)}`
          : isDragOver
            ? `1px solid ${hexToRgba(theme.highlight, 0.4)}`
            : isDraggable
            ? `1px solid ${theme.borderSubtle}`
            : '1px solid transparent',
        borderRadius: isDraggable ? 6 : undefined,
        transition: 'background 0.1s, border-color 0.1s',
        animation: flash ? 'match-swap-blink 0.5s ease' : undefined,
      }}
    >
      {/* Drag handle */}
      {isDraggable && (
        <span style={{
          fontSize: 10,
          color: theme.textSubtle,
          cursor: 'grab',
          userSelect: 'none',
          flexShrink: 0,
          width: 8,
          opacity: 0.5,
        }}>
          ⠿
        </span>
      )}

      {/* Number badge */}
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: isOnPitch ? teamColor : hexToRgba(teamColor, 0.4),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          fontWeight: 700,
          color: '#fff',
          flexShrink: 0,
        }}
      >
        {editable && editing === 'number' ? (
          <input
            type="text"
            autoFocus
            defaultValue={number.toString()}
            onBlur={e => { onEdit?.('number', e.target.value); setEditing(null); }}
            onKeyDown={e => {
              if (e.key === 'Enter') { onEdit?.('number', (e.target as HTMLInputElement).value); setEditing(null); }
              if (e.key === 'Escape') setEditing(null);
            }}
            onClick={e => e.stopPropagation()}
            style={{
              width: 20,
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              fontSize: 10,
              fontWeight: 700,
              textAlign: 'center',
              outline: 'none',
            }}
          />
        ) : (
          <span
            onClick={editable ? () => setEditing('number') : undefined}
            style={{ cursor: editable ? 'pointer' : undefined }}
          >
            {number}
          </span>
        )}
      </div>

      {/* Name + position */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {editable && editing === 'name' ? (
          <input
            type="text"
            autoFocus
            defaultValue={name}
            placeholder="Name"
            onBlur={e => { onEdit?.('name', e.target.value); setEditing(null); }}
            onKeyDown={e => {
              if (e.key === 'Enter') { onEdit?.('name', (e.target as HTMLInputElement).value); setEditing(null); }
              if (e.key === 'Escape') setEditing(null);
            }}
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.05)',
              border: `1px solid ${theme.borderSubtle}`,
              borderRadius: 3,
              color: theme.secondary,
              fontSize: 11,
              padding: '1px 4px',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
        ) : (
          <div
            onClick={editable ? () => setEditing('name') : undefined}
            style={{
              fontSize: 11,
              color: theme.secondary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              cursor: editable ? 'pointer' : undefined,
            }}
          >
            {name || `Player #${number}`}
          </div>
        )}
        <div style={{ fontSize: 9, color: theme.textSubtle, display: 'flex', gap: 4 }}>
          {positions.map(pos => (
            <span
              key={pos}
              style={{
                background: hexToRgba(theme.highlight, 0.12),
                color: theme.highlight,
                padding: '0 3px',
                borderRadius: 2,
                fontSize: 8,
                fontWeight: 600,
              }}
            >
              {ROLE_LABELS[pos] || pos}
            </span>
          ))}
          {subMinute !== undefined && (
            <span style={{ color: theme.textSubtle }}>
              {isOnPitch ? `${subMinute}'→` : `→${subMinute}'`}
            </span>
          )}
        </div>
      </div>

      {/* Minutes bar */}
      <div style={{ width: 60, flexShrink: 0 }}>
        <div
          style={{
            height: 6,
            background: hexToRgba(theme.borderSubtle, 0.5),
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${barWidth}%`,
              background: '#22c55e',
              borderRadius: 3,
              transition: 'width 0.2s',
            }}
          />
        </div>
      </div>

      {/* Minutes text */}
      <span
        style={{
          fontSize: 10,
          color: theme.textMuted,
          fontWeight: 600,
          width: 32,
          textAlign: 'right',
          flexShrink: 0,
        }}
      >
        {minutesPlayed}&prime;
      </span>
    </div>
  );
}
