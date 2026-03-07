// Sentry must initialize before other imports
import './lib/sentry';
import { Sentry } from './lib/sentry';

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './state/AuthContext'
import { TeamProvider } from './state/TeamContext'

createRoot(document.getElementById('root')!, {
  // React 19 error hooks — attach component stacks to Sentry events
  onUncaughtError: Sentry.reactErrorHandler((error, errorInfo) => {
    console.error('Uncaught error:', error, errorInfo);
  }),
  onCaughtError: Sentry.reactErrorHandler((error, errorInfo) => {
    console.warn('Caught error:', error, errorInfo);
  }),
  onRecoverableError: Sentry.reactErrorHandler((error, errorInfo) => {
    console.warn('Recoverable error:', error, errorInfo);
  }),
}).render(
  <StrictMode>
    <AuthProvider>
      <TeamProvider>
        <App />
      </TeamProvider>
    </AuthProvider>
  </StrictMode>,
)
