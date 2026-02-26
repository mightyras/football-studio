import { useRef } from 'react';
import { useAuth } from '../../state/AuthContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import { hexToRgba } from '../../utils/colorUtils';

interface WelcomeModalProps {
  onClose: () => void;
  onStartTour: () => void;
}

export function WelcomeModal({ onClose, onStartTour }: WelcomeModalProps) {
  const { profile, user } = useAuth();
  const theme = useThemeColors();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Extract first name: try profile display_name, then user metadata, fallback to 'there'
  const fullName =
    profile?.display_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.display_name ||
    '';
  const firstName = fullName.split(' ')[0] || 'there';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1200,
      }}
      onKeyDown={e => e.stopPropagation()}
      onKeyUp={e => e.stopPropagation()}
      onMouseDown={e => {
        if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        style={{
          background: theme.border,
          border: `1px solid ${theme.borderSubtle}`,
          borderRadius: 10,
          padding: '28px 28px 22px',
          maxWidth: 420,
          width: '90%',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
        }}
      >
        {/* Title */}
        <h2
          style={{
            margin: '0 0 6px',
            fontSize: 20,
            fontWeight: 700,
            color: theme.secondary,
            textAlign: 'center',
          }}
        >
          Welcome, {firstName}!
        </h2>

        {/* Description */}
        <p
          style={{
            margin: '0 0 18px',
            fontSize: 12,
            color: theme.textMuted,
            lineHeight: 1.7,
            textAlign: 'center',
          }}
        >
          Football Tactics Studio is a digital tactics board designed for creating and
          presenting tactical concepts in a simple and interactive way. Build
          formations, draw passing sequences, annotate movement patterns, and
          animate your ideas step by step. Save multiple boards and collaborate
          with your team in real time.
        </p>

        {/* Buttons */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <button
            onClick={onStartTour}
            style={{
              width: '100%',
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'inherit',
              border: `1px solid ${theme.highlight}`,
              borderRadius: 6,
              background: hexToRgba(theme.highlight, 0.15),
              color: theme.highlight,
              cursor: 'pointer',
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = hexToRgba(theme.highlight, 0.3);
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = hexToRgba(theme.highlight, 0.15);
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none" />
            </svg>
            Take a Tour
          </button>

          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 500,
              fontFamily: 'inherit',
              border: `1px solid ${theme.borderSubtle}`,
              borderRadius: 6,
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
            Get Started
          </button>
        </div>

        {/* Help note */}
        <p
          style={{
            margin: '14px 0 0',
            fontSize: 10,
            color: theme.textSubtle,
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          You can always start the tour from the Help panel.
        </p>
      </div>
    </div>
  );
}
