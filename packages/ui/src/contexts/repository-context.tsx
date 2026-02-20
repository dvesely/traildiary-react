import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type {
  TrailRepository,
  TrailDayRepository,
  ActivityRepository,
  TrackpointRepository,
} from '@traildiary/core'

export interface Repositories {
  trails: TrailRepository
  trailDays: TrailDayRepository
  activities: ActivityRepository
  trackpoints: TrackpointRepository
}

const RepositoryContext = createContext<Repositories | null>(null)

export function RepositoryProvider({
  children,
  repositories,
}: {
  children: ReactNode
  repositories: Repositories
}) {
  return (
    <RepositoryContext.Provider value={repositories}>
      {children}
    </RepositoryContext.Provider>
  )
}

export function useRepositories(): Repositories {
  const ctx = useContext(RepositoryContext)
  if (!ctx) throw new Error('useRepositories must be used within RepositoryProvider')
  return ctx
}
