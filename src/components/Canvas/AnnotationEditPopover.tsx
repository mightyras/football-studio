import { useState, useEffect, useRef } from 'react';
import { useAppState } from '../../state/AppStateContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import { hexToRgba } from '../../utils/colorUtils';
import { computeStepOrder } from '../../animation/annotationAnimator';
import type { Annotation, PitchTransform, TextAnnotation } from '../../types';

const getColorPresets = (highlight: string) => [
  '#ffffff',
  highlight,
  '#ef4444',
  '#22d3ee',
  '#10b981',
  '#3F8E51',
  '#000000',
];

const FONT_SIZES: { label: string; value: number }[] = [
  { label: 'S', value: 1.8 },
  { label: 'M', value: 2.5 },
  { label: 'L', value: 3.5 },
];

type LineAnnotation = Extract<Annotation, { type: 'passing-line' | 'running-line' | 'curved-run' | 'dribble-line' }>;
const isLineAnnotation = (a: Annotation): a is LineAnnotation =>
  a.type === 'passing-line' || a.type === 'running-line' || a.type === 'curved-run' || a.type === 'dribble-line';

// ── Line annotation editor (step number + color) ──

function LineAnnotationEditor({
  ann,
  transform,
  effectiveStep,
}: {
  ann: LineAnnotation;
  transform: PitchTransform;
  effectiveStep: number;
}) {
  const { dispatch } = useAppState();
  const theme = useThemeColors();
  const [step, setStep] = useState(effectiveStep);
  const [color, setColor] = useState(ann.color);

  useEffect(() => {
    setStep(effectiveStep);
    setColor(ann.color);
  }, [ann.id, effectiveStep]);

  // Compute position: midpoint of line
  const midX = (ann.start.x + ann.end.x) / 2;
  const midY = (ann.start.y + ann.end.y) / 2;
  const pos = transform.worldToScreen(midX, midY);

  const save = () => {
    dispatch({
      type: 'EDIT_ANNOTATION',
      annotationId: ann.id,
      changes: { animStep: step, color } as Partial<LineAnnotation>,
    });
    dispatch({ type: 'STOP_EDITING_ANNOTATION' });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      save();
    } else if (e.key === 'Escape') {
      dispatch({ type: 'STOP_EDITING_ANNOTATION' });
    }
    e.stopPropagation();
  };

  const lineTypeLabel =
    ann.type === 'passing-line' ? 'Pass' :
    ann.type === 'running-line' ? 'Run' :
    ann.type === 'curved-run' ? 'Curved Run' :
    'Dribble';

  return (
    <div
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y - 8,
        transform: 'translate(-50%, -100%)',
        background: theme.border,
        border: `1px solid ${theme.highlight}`,
        borderRadius: 8,
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 10,
        minWidth: 160,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
      }}
      onPointerDown={e => e.stopPropagation()}
    >
      {/* Arrow */}
      <div
        style={{
          position: 'absolute',
          bottom: -6,
          left: '50%',
          transform: 'translateX(-50%) rotate(45deg)',
          width: 10,
          height: 10,
          background: theme.border,
          borderRight: `1px solid ${theme.highlight}`,
          borderBottom: `1px solid ${theme.highlight}`,
        }}
      />

      {/* Line type label */}
      <span style={{ fontSize: 11, color: theme.secondary, fontWeight: 600 }}>
        {lineTypeLabel} Line
      </span>

      {/* Step number */}
      <label style={{ fontSize: 10, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Animation Step
      </label>
      <div style={{ display: 'flex', gap: 4 }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(s => (
          <button
            key={s}
            onClick={() => setStep(s)}
            onKeyDown={handleKeyDown}
            style={{
              width: 24,
              height: 24,
              fontSize: 11,
              fontWeight: step === s ? 700 : 400,
              background: step === s ? hexToRgba(theme.highlight, 0.2) : theme.inputBg,
              border: step === s ? `1px solid ${theme.highlight}` : `1px solid ${theme.borderSubtle}`,
              borderRadius: 4,
              color: step === s ? theme.highlight : theme.textMuted,
              cursor: 'pointer',
              padding: 0,
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Color swatches */}
      <label style={{ fontSize: 10, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Color
      </label>
      <div style={{ display: 'flex', gap: 4 }}>
        {getColorPresets(theme.highlight).map(c => (
          <button
            key={c}
            onClick={() => setColor(c)}
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: c,
              border: color === c ? `2px solid ${theme.highlight}` : `2px solid ${theme.borderSubtle}`,
              cursor: 'pointer',
              padding: 0,
              flexShrink: 0,
            }}
          />
        ))}
      </div>

      <button
        onClick={save}
        style={{
          marginTop: 2,
          padding: '4px 0',
          background: theme.highlight,
          color: '#0a0e1a',
          border: 'none',
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Save
      </button>
    </div>
  );
}

// ── Main popover component ──

export function AnnotationEditPopover({ transform }: { transform: PitchTransform }) {
  const { state, dispatch } = useAppState();
  const theme = useThemeColors();

  const ann = state.annotations.find(a => a.id === state.editingAnnotationId);
  const textRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState('');
  const [color, setColor] = useState('#ffffff');
  const [fontSize, setFontSize] = useState(2.5);

  useEffect(() => {
    if (ann && ann.type === 'text') {
      setText(ann.text);
      setColor(ann.color);
      setFontSize(ann.fontSize);
      setTimeout(() => textRef.current?.select(), 0);
    }
  }, [ann?.id]);

  if (!ann) return null;

  // Line annotation editor
  if (isLineAnnotation(ann)) {
    // Compute effective step from auto-ordering
    const allLineAnns = state.annotations.filter(isLineAnnotation);
    const stepOrder = computeStepOrder(allLineAnns);
    const annIndex = allLineAnns.findIndex(a => a.id === ann.id);
    const effectiveStep = stepOrder && annIndex >= 0
      ? stepOrder[annIndex]
      : (ann.animStep ?? 1);
    return <LineAnnotationEditor ann={ann} transform={transform} effectiveStep={effectiveStep} />;
  }

  // Text annotation editor
  if (ann.type !== 'text') return null;

  const textAnn = ann as TextAnnotation;
  const pos = transform.worldToScreen(textAnn.position.x, textAnn.position.y);

  const save = () => {
    if (text.trim()) {
      dispatch({
        type: 'EDIT_ANNOTATION',
        annotationId: textAnn.id,
        changes: { text: text.trim(), color, fontSize } as Partial<TextAnnotation>,
      });
    } else {
      // Delete annotation if text is empty
      dispatch({ type: 'DELETE_ANNOTATION', annotationId: textAnn.id });
    }
    dispatch({ type: 'STOP_EDITING_ANNOTATION' });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      save();
    } else if (e.key === 'Escape') {
      dispatch({ type: 'STOP_EDITING_ANNOTATION' });
    }
    e.stopPropagation();
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y - 8,
        transform: 'translate(-50%, -100%)',
        background: theme.border,
        border: `1px solid ${theme.highlight}`,
        borderRadius: 8,
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 10,
        minWidth: 180,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
      }}
      onPointerDown={e => e.stopPropagation()}
    >
      {/* Arrow */}
      <div
        style={{
          position: 'absolute',
          bottom: -6,
          left: '50%',
          transform: 'translateX(-50%) rotate(45deg)',
          width: 10,
          height: 10,
          background: theme.border,
          borderRight: `1px solid ${theme.highlight}`,
          borderBottom: `1px solid ${theme.highlight}`,
        }}
      />

      {/* Text input */}
      <label style={{ fontSize: 10, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Text
      </label>
      <input
        ref={textRef}
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Label text"
        style={{
          width: '100%',
          padding: '4px 8px',
          background: theme.inputBg,
          border: `1px solid ${theme.borderSubtle}`,
          borderRadius: 4,
          color: theme.secondary,
          fontSize: 14,
          fontFamily: 'inherit',
          outline: 'none',
        }}
        onFocus={e => { e.target.style.borderColor = theme.highlight; }}
        onBlur={e => { e.target.style.borderColor = theme.borderSubtle; }}
      />

      {/* Color swatches */}
      <label style={{ fontSize: 10, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Color
      </label>
      <div style={{ display: 'flex', gap: 4 }}>
        {getColorPresets(theme.highlight).map(c => (
          <button
            key={c}
            onClick={() => setColor(c)}
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: c,
              border: color === c ? `2px solid ${theme.highlight}` : `2px solid ${theme.borderSubtle}`,
              cursor: 'pointer',
              padding: 0,
              flexShrink: 0,
            }}
          />
        ))}
      </div>

      {/* Font size */}
      <label style={{ fontSize: 10, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Size
      </label>
      <div style={{ display: 'flex', gap: 4 }}>
        {FONT_SIZES.map(fs => (
          <button
            key={fs.label}
            onClick={() => setFontSize(fs.value)}
            style={{
              flex: 1,
              padding: '3px 0',
              background: Math.abs(fontSize - fs.value) < 0.01 ? hexToRgba(theme.highlight, 0.2) : theme.inputBg,
              border: Math.abs(fontSize - fs.value) < 0.01 ? `1px solid ${theme.highlight}` : `1px solid ${theme.borderSubtle}`,
              borderRadius: 4,
              color: Math.abs(fontSize - fs.value) < 0.01 ? theme.highlight : theme.textMuted,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {fs.label}
          </button>
        ))}
      </div>

      <button
        onClick={save}
        style={{
          marginTop: 2,
          padding: '4px 0',
          background: theme.highlight,
          color: '#0a0e1a',
          border: 'none',
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Save
      </button>
    </div>
  );
}
