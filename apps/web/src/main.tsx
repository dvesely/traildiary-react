// apps/web/src/main.tsx

import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DbProvider } from './application/providers/db-provider.js'
import { routeTree } from './routeTree.gen.js'
import './app.css'
import { initDbAdapter } from './infrastructure/wa-sqlite-adapter.js'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

;(async () => {
  try {
    await initDbAdapter()
  } catch (error) {
    console.error('DB init failed:', error)
    // Optionally handle error, e.g., show an error screen
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <DbProvider>
        <RouterProvider router={router} />
      </DbProvider>
    </StrictMode>,
  )
})()
