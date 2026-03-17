import { useAppState } from '../../state/AppStateContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import { hexToRgba } from '../../utils/colorUtils';

export function MatchRuleConfig() {
  const { state, dispatch } = useAppState();
  const theme = useThemeColors();

  const plan = state.matchPlan;
  if (!plan) return null;

  return (
    <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Rule mode */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, color: theme.textSubtle, textTransform: 'uppercase', letterSpacing: '0.05em', width: 50, flexShrink: 0 }}>
          Rules
        </span>
        <div style={{ display: 'flex', gap: 2, flex: 1 }}>
          {(['fifa-standard', 'free'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => dispatch({ type: 'SET_MATCH_RULE_MODE', mode })}
              style={{
                flex: 1,
                padding: '4px 8px',
                fontSize: 10,
                fontFamily: 'inherit',
                fontWeight: plan.ruleMode === mode ? 600 : 400,
                border: plan.ruleMode === mode
                  ? `1px solid ${theme.highlight}`
                  : `1px solid ${theme.borderSubtle}`,
                borderRadius: 3,
                background: plan.ruleMode === mode
                  ? hexToRgba(theme.highlight, 0.15)
                  : 'transparent',
                color: plan.ruleMode === mode ? theme.highlight : theme.textMuted,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {mode === 'fifa-standard' ? 'FIFA Standard' : 'Free Subs'}
            </button>
          ))}
        </div>
      </div>

      {/* Extra time toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, color: theme.textSubtle, textTransform: 'uppercase', letterSpacing: '0.05em', width: 50, flexShrink: 0 }}>
          Duration
        </span>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            fontSize: 11,
            color: theme.secondary,
          }}
        >
          <input
            type="checkbox"
            checked={plan.hasExtraTime}
            onChange={e => dispatch({ type: 'SET_MATCH_EXTRA_TIME', hasExtraTime: e.target.checked })}
            style={{ accentColor: theme.highlight }}
          />
          Extra time (120 min)
        </label>
      </div>

      {/* Rule summary */}
      {plan.ruleMode === 'fifa-standard' && (
        <div
          style={{
            fontSize: 9,
            color: theme.textSubtle,
            lineHeight: 1.5,
            padding: '4px 8px',
            background: hexToRgba(theme.borderSubtle, 0.3),
            borderRadius: 3,
          }}
        >
          Max {plan.hasExtraTime ? '6' : '5'} subs in {plan.hasExtraTime ? '4' : '3'} windows.
          Halftime subs are free.
          {plan.hasExtraTime && ' 1 extra sub allowed in extra time.'}
        </div>
      )}
    </div>
  );
}
