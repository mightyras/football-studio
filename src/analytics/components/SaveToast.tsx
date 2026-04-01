import { useEffect, useState } from 'react';
import { THEME } from '../../constants/colors';

type Props = {
  message: string;
  onDone: () => void;
};

/**
 * Brief toast notification that slides in from the bottom, stays for 2s, then fades out.
 */
export function SaveToast({ message, onDone }: Props) {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Slide in
    requestAnimationFrame(() => setVisible(true));

    // Start fade out after 1.5s
    const fadeTimer = setTimeout(() => setFading(true), 1500);
    // Remove after 2s
    const removeTimer = setTimeout(() => onDone(), 2000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [onDone]);

  return (
    <div style={{
      position: 'fixed',
      bottom: visible ? 24 : -50,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 3000,
      background: '#22c55e',
      color: '#000',
      padding: '10px 20px',
      borderRadius: 8,
      fontSize: 13,
      fontWeight: 600,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      transition: 'bottom 0.3s ease-out, opacity 0.4s',
      opacity: fading ? 0 : 1,
      pointerEvents: 'none',
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      {message}
    </div>
  );
}
