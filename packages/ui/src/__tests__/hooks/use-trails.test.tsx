import { describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { RepositoryProvider } from '../../contexts/repository-context.js'
import { useTrails } from '../../hooks/use-trails.js'
import type { Repositories } from '../../contexts/repository-context.js'
import type { TrailSummaryDto } from '@traildiary/core'

const summaries: TrailSummaryDto[] = [
  { id: '1', name: 'Trail A', totalDistance: 10, startAt: 1704067200000, endAt: 1704240000000 },
]

function makeRepos(overrides: Partial<Repositories['trails']> = {}): Repositories {
  return {
    trails: {
      createTrail: vi.fn(),
      getTrail: vi.fn(),
      listTrails: vi.fn(),
      listTrailSummaries: vi.fn().mockResolvedValue(summaries),
      deleteTrail: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    },
    trailDays: { createTrailDay: vi.fn(), getTrailDays: vi.fn(), deleteTrailDay: vi.fn() },
    activities: { createActivity: vi.fn(), getActivities: vi.fn(), deleteActivity: vi.fn() },
    trackpoints: { insertTrackpoints: vi.fn(), getTrackpoints: vi.fn(), getTrackpointsSampled: vi.fn(), recalculatePointIndices: vi.fn() },
  }
}

function wrapper(repos: Repositories) {
  return ({ children }: { children: ReactNode }) => (
    <RepositoryProvider repositories={repos}>{children}</RepositoryProvider>
  )
}

describe('useTrails', () => {
  it('loads trail summaries on mount', async () => {
    const repos = makeRepos()
    const { result } = renderHook(() => useTrails(), { wrapper: wrapper(repos) })
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.trails).toEqual(summaries)
  })

  it('deleteTrail removes trail from list', async () => {
    const repos = makeRepos()
    const { result } = renderHook(() => useTrails(), { wrapper: wrapper(repos) })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.deleteTrail('1') })
    expect(result.current.trails).toHaveLength(0)
  })
})
