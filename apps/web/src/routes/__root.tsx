import { createRootRoute, Outlet } from '@tanstack/react-router'
import { AppLayout } from '../ui/layout/app-layout.js'

function RootComponent() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  )
}

export const Route = createRootRoute({
  component: RootComponent,
})
