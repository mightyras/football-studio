import { useEffect, useState, useCallback, useRef } from 'react';
import { TOUR_STEPS, type TourPlacement } from './tourSteps';
import { useTour } from './useTour';
import { useThemeColors } from '../../hooks/useThemeColors';
import { hexToRgba } from '../../utils/colorUtils';

const SPOTLIGHT_PAD = 8;
const TOOLTIP_GAP = 12;
const TOOLTIP_WIDTH = 280;
const TOOLTIP_MAX_H = 200;
const FADE_MS = 200;
const MOVE_MS = 300;

interface TargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function getTargetRect(selector: string): TargetRect | null {
  const el = document.querySelector(`[data-tour="${selector}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, width: r.width, height: r.height };
}

function computeTooltipPos(
  rect: TargetRect,
  preferred: TourPlacement,
  vw: number,
  vh: number,
  pad: number,
): { top: number; left: number; actualPlacement: TourPlacement } {
  // For large elements (covering most of the viewport), position inside the element
  const isLargeElement = rect.width > vw * 0.4 && rect.height > vh * 0.4;
  if (isLargeElement) {
    return {
      top: rect.y + 40,
      left: rect.x + rect.width / 2 - TOOLTIP_WIDTH / 2,
      actualPlacement: preferred,
    };
  }

  const tryPlacement = (p: TourPlacement): { top: number; left: number } | null => {
    let top: number, left: number;
    switch (p) {
      case 'right':
        left = rect.x + rect.width + pad + TOOLTIP_GAP;
        top = rect.y + rect.height / 2 - 60;
        if (left + TOOLTIP_WIDTH > vw - 16) return null;
        break;
      case 'left':
        left = rect.x - pad - TOOLTIP_GAP - TOOLTIP_WIDTH;
        top = rect.y + rect.height / 2 - 60;
        if (left < 16) return null;
        break;
      case 'bottom':
        top = rect.y + rect.height + pad + TOOLTIP_GAP;
        left = rect.x + rect.width / 2 - TOOLTIP_WIDTH / 2;
        if (top + 120 > vh - 16) return null;
        break;
      case 'top':
        top = rect.y - pad - TOOLTIP_GAP - 120;
        left = rect.x + rect.width / 2 - TOOLTIP_WIDTH / 2;
        if (top < 16) return null;
        break;
    }
    return { top, left };
  };

  const placements: TourPlacement[] = [preferred, 'bottom', 'right', 'left', 'top'];
  for (const p of placements) {
    const pos = tryPlacement(p);
    if (pos) {
      // Clamp to viewport (both top and bottom)
      pos.left = Math.max(16, Math.min(pos.left, vw - TOOLTIP_WIDTH - 16));
      pos.top = Math.max(16, Math.min(pos.top, vh - TOOLTIP_MAX_H - 16));
      return { ...pos, actualPlacement: p };
    }
  }
  // Fallback: center below target
  return {
    top: Math.max(16, Math.min(rect.y + rect.height + TOOLTIP_GAP, vh - TOOLTIP_MAX_H - 16)),
    left: Math.max(16, Math.min(rect.x, vw - TOOLTIP_WIDTH - 16)),
    actualPlacement: 'bottom',
  };
}

export function TourOverlay() {
  const tour = useTour();
  const theme = useThemeColors();
  const [opacity, setOpacity] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Find target element rect
  const updateRect = useCallback(() => {
    if (!tour.isOpen) return;
    const step = TOUR_STEPS[tour.currentStep];
    if (!step) return;
    const rect = getTargetRect(step.selector);
    if (!rect) {
      // Target element not found — auto-skip to next step
      tour.next();
      return;
    }
    setTargetRect(rect);
  }, [tour.isOpen, tour.currentStep, tour]);

  useEffect(() => {
    updateRect();
    window.addEventListener('resize', updateRect);
    return () => window.removeEventListener('resize', updateRect);
  }, [updateRect]);

  // Reset drag offset when step changes
  useEffect(() => {
    setDragOffset({ x: 0, y: 0 });
  }, [tour.currentStep]);

  // Drag handlers for tooltip repositioning
  useEffect(() => {
    if (!tour.isOpen) return;
    const handleMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      setDragOffset({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      });
    };
    const handleUp = () => {
      dragging.current = false;
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [tour.isOpen]);

  // Fade in/out
  useEffect(() => {
    if (tour.isOpen) {
      requestAnimationFrame(() => setOpacity(1));
    } else {
      setOpacity(0);
    }
  }, [tour.isOpen]);

  // Keyboard navigation (capture phase to block app shortcuts)
  useEffect(() => {
    if (!tour.isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        tour.next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        tour.back();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        tour.skip();
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [tour]);

  if (!tour.isOpen || !targetRect) return null;

  const step = TOUR_STEPS[tour.currentStep];
  if (!step) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Spotlight rect (padded around target — per-step or default, clamped to viewport)
  const pad = step.spotlightPadding ?? SPOTLIGHT_PAD;
  const rawSx = targetRect.x - pad;
  const rawSy = targetRect.y - pad;
  const rawSw = targetRect.width + pad * 2;
  const rawSh = targetRect.height + pad * 2;
  const sx = Math.max(0, rawSx);
  const sy = Math.max(0, rawSy);
  const sw = Math.min(rawSw - (sx - rawSx), vw - sx);
  const sh = Math.min(rawSh - (sy - rawSy), vh - sy);

  const tooltip = computeTooltipPos(targetRect, step.placement, vw, vh, pad);
  const isFirst = tour.currentStep === 0;
  const isLast = tour.currentStep === tour.totalSteps - 1;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        pointerEvents: 'auto',
        opacity,
        transition: `opacity ${FADE_MS}ms ease`,
      }}
      onClick={(e) => {
        // Click on backdrop = skip tour
        if (e.target === e.currentTarget) {
          tour.skip();
        }
      }}
    >
      {/* SVG backdrop with spotlight cutout */}
      <svg
        width={vw}
        height={vh}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
        }}
      >
        <defs>
          <mask id="tour-spotlight-mask">
            <rect x="0" y="0" width={vw} height={vh} fill="white" />
            <rect
              x={sx}
              y={sy}
              width={sw}
              height={sh}
              rx="8"
              ry="8"
              fill="black"
              style={{ transition: `all ${MOVE_MS}ms ease` }}
            />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width={vw}
          height={vh}
          fill="rgba(0,0,0,0.6)"
          mask="url(#tour-spotlight-mask)"
          style={{ pointerEvents: 'auto', cursor: 'pointer' }}
          onClick={() => tour.skip()}
        />
      </svg>

      {/* Tooltip card */}
      <div
        style={{
          position: 'absolute',
          top: tooltip.top + dragOffset.y,
          left: tooltip.left + dragOffset.x,
          width: TOOLTIP_WIDTH,
          background: theme.surface,
          border: `1px solid ${theme.borderSubtle}`,
          borderRadius: 10,
          padding: '16px 18px 14px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          transition: dragging.current
            ? 'none'
            : `top ${MOVE_MS}ms ease, left ${MOVE_MS}ms ease`,
          pointerEvents: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Title row — doubles as drag handle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 6,
            cursor: 'grab',
            userSelect: 'none',
          }}
          onPointerDown={e => {
            dragging.current = true;
            dragStart.current = {
              x: e.clientX - dragOffset.x,
              y: e.clientY - dragOffset.y,
            };
            e.preventDefault();
          }}
        >
          {/* Drag grip indicator */}
          <span style={{ color: theme.textSubtle, fontSize: 11, lineHeight: 1, letterSpacing: 1 }}>
            ⠿
          </span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: theme.secondary,
            }}
          >
            {step.title}
          </span>
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.6,
            color: theme.textMuted,
            marginBottom: 14,
          }}
        >
          {step.description}
        </div>

        {/* Footer: step counter + navigation */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: theme.textSubtle,
            }}
          >
            {tour.currentStep + 1} of {tour.totalSteps}
          </span>

          <div style={{ display: 'flex', gap: 6 }}>
            {!isFirst && (
              <button
                onClick={tour.back}
                style={{
                  padding: '5px 12px',
                  fontSize: 11,
                  fontFamily: 'inherit',
                  border: `1px solid ${theme.borderSubtle}`,
                  borderRadius: 5,
                  background: 'transparent',
                  color: theme.textMuted,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = theme.secondary;
                  e.currentTarget.style.color = theme.secondary;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = theme.borderSubtle;
                  e.currentTarget.style.color = theme.textMuted;
                }}
              >
                Back
              </button>
            )}
            <button
              onClick={tour.next}
              style={{
                padding: '5px 14px',
                fontSize: 11,
                fontWeight: 600,
                fontFamily: 'inherit',
                border: `1px solid ${theme.highlight}`,
                borderRadius: 5,
                background: hexToRgba(theme.highlight, 0.15),
                color: theme.highlight,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = hexToRgba(theme.highlight, 0.3);
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = hexToRgba(theme.highlight, 0.15);
              }}
            >
              {isLast ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>

        {/* Skip link */}
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <button
            onClick={tour.skip}
            style={{
              background: 'none',
              border: 'none',
              color: theme.textSubtle,
              fontSize: 10,
              cursor: 'pointer',
              fontFamily: 'inherit',
              padding: '2px 8px',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = theme.textMuted; }}
            onMouseLeave={e => { e.currentTarget.style.color = theme.textSubtle; }}
          >
            Skip tour
          </button>
        </div>
      </div>
    </div>
  );
}
