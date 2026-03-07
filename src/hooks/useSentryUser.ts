import { useEffect } from 'react';
import { Sentry } from '../lib/sentry';
import { useAuth } from '../state/AuthContext';

/**
 * Syncs the current Supabase user to Sentry's user context.
 * Only sends the user ID (UUID) — no email, no name, no PII.
 */
export function useSentryUser(): void {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      Sentry.setUser({ id: user.id });
    } else {
      Sentry.setUser(null);
    }
  }, [user]);
}
