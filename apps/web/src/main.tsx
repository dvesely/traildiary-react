import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen.js'
import { DbProvider } from './application/providers/db-provider.js'
import migrationSql from '@traildiary/db/src/migrations/001-initial-schema.sql?raw'
import './app.css'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DbProvider migrationSql={migrationSql}>
      <RouterProvider router={router} />
    </DbProvider>
  </StrictMode>
)
