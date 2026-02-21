import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './state/AuthContext'
import { TeamProvider } from './state/TeamContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <TeamProvider>
        <App />
      </TeamProvider>
    </AuthProvider>
  </StrictMode>,
)
