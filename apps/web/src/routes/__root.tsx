import { createRootRoute, Outlet } from '@tanstack/react-router'
import { AppLayout } from '../ui/layout/app-layout.js'
import { useDbStatus } from '../application/providers/db-provider.js'

function RootComponent() {
  const { isReady } = useDbStatus()

  return (
    <AppLayout>
      {isReady ? (
        <Outlet />
      ) : (
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-400">Initializing database...</p>
        </div>
      )}
    </AppLayout>
  )
}

export const Route = createRootRoute({
  component: RootComponent,
})
