// apps/web/src/main.tsx

import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DbProvider } from './application/providers/db-provider.js'
import { routeTree } from './routeTree.gen.js'
import './app.css'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DbProvider>
      <RouterProvider router={router} />
    </DbProvider>
  </StrictMode>,
)
