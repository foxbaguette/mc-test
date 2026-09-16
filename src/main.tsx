import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'

import { endpointPool } from '@/chain/endpoints'
import { queryClient } from '@/data/queryClient'
import { useSession } from '@/state/session'
import { App } from './App'

import './styles/global.css'

// Rank the WAX nodes and restore any stored wallet session before the first protected screen.
void endpointPool.probe()
void useSession.getState().restore()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* Served under a sub-path on GitHub Pages; "" when the base is "/". */}
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
)
