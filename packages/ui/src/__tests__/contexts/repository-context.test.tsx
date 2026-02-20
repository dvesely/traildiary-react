import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { RepositoryProvider, useRepositories } from '../../contexts/repository-context.js'
import type { Repositories } from '../../contexts/repository-context.js'

const mockRepos: Repositories = {
  trails: { createTrail: vi.fn(), getTrail: vi.fn(), listTrails: vi.fn(), listTrailSummaries: vi.fn(), deleteTrail: vi.fn() },
  trailDays: { createTrailDay: vi.fn(), getTrailDays: vi.fn(), deleteTrailDay: vi.fn() },
  activities: { createActivity: vi.fn(), getActivities: vi.fn(), deleteActivity: vi.fn() },
  trackpoints: { insertTrackpoints: vi.fn(), getTrackpoints: vi.fn(), getTrackpointsSampled: vi.fn(), recalculatePointIndices: vi.fn() },
}

describe('RepositoryContext', () => {
  it('provides repositories via useRepositories', () => {
    const { result } = renderHook(() => useRepositories(), {
      wrapper: ({ children }) => (
        <RepositoryProvider repositories={mockRepos}>{children}</RepositoryProvider>
      ),
    })
    expect(result.current.trails).toBe(mockRepos.trails)
    expect(result.current.trailDays).toBe(mockRepos.trailDays)
  })

  it('throws when used outside RepositoryProvider', () => {
    expect(() =>
      renderHook(() => useRepositories())
    ).toThrow('useRepositories must be used within RepositoryProvider')
  })
})
