import { createRootRoute, Outlet } from '@tanstack/react-router'
import { AppLayout } from '../ui/layout/app-layout.js'

export const Route = createRootRoute({
  component: () => (
    <AppLayout>
      <Outlet />
    </AppLayout>
  ),
})
