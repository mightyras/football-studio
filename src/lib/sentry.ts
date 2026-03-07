import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

if (dsn) {
  Sentry.init({
    dsn,

    // Environment tagging ('development' | 'production')
    environment: import.meta.env.MODE,

    // Only send errors in production to conserve the 5K/month free-tier budget
    enabled: import.meta.env.PROD,

    // Performance monitoring (free tier: 10K units/month)
    // 10% sampling in production keeps well within quota
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,

    // Session replay disabled (not available on free tier)
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    // Filter noisy browser errors that aren't actionable
    ignoreErrors: [
      // Browser extensions / resize observer
      /^ResizeObserver loop/,
      // Network errors users can't control
      /^NetworkError/,
      /^Failed to fetch/,
      /^Load failed/,
      // Supabase token refresh when offline (already handled in AuthContext)
      /AuthRetryableFetchError/,
    ],
  });
}

export { Sentry };
