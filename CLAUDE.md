# Football Tactics Studio - Claude Code Notes

## Dev Server

The dev server runs on port 5174. Start it with `preview_start` using the "dev" configuration in `.claude/launch.json`.

## Authentication

The app uses Supabase auth with a login modal that blocks the UI when unauthenticated.

**Auto-login is configured**: `.env.local` contains `VITE_DEV_AUTO_LOGIN_EMAIL` and `VITE_DEV_AUTO_LOGIN_PASSWORD`. When the dev server starts, `AuthContext` automatically signs in with these credentials if no session exists. No manual login steps are needed for preview validation.

If auto-login fails (e.g., credentials expired), test credentials are stored in `.test-credentials.local`.

## Tech Stack

- React 19 + Vite + TypeScript
- Supabase (auth, database, realtime)
- HTML Canvas for pitch rendering
- Sentry for error tracking
