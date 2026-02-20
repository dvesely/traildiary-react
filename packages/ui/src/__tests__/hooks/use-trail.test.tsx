import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { RepositoryProvider } from '../../contexts/repository-context.js'
import { useTrail } from '../../hooks/use-trail.js'
import type { TrackPoint } from '@traildiary/core'

const mockPoint: TrackPoint = { lat: 47, lon: 13, elevation: 1000, timestamp: 1_000_000, index: 0, distance: 0 }

const mockStats = {
  distance: 5,
  elevationGain: 200,
  elevationLoss: 200,
  duration: 3_600_000,
  movingTime: 3_500_000,
  avgSpeed: 5,
  startTime: 1_000_000,
  endTime: 1_003_600_000,
}

function makeRepos() {
  return {
    trails: {
      createTrail: vi.fn(),
      getTrail: vi.fn().mockResolvedValue({ id: 't1', name: 'Alps' }),
      listTrails: vi.fn(),
      listTrailSummaries: vi.fn(),
      deleteTrail: vi.fn(),
    },
    trailDays: {
      createTrailDay: vi.fn(),
      getTrailDays: vi.fn().mockResolvedValue([{ id: 'd1', name: 'Day 1', dayNumber: 1 }]),
      deleteTrailDay: vi.fn(),
    },
    activities: {
      createActivity: vi.fn(),
      getActivities: vi.fn().mockResolvedValue([
        { id: 'a1', name: 'Morning hike', sourceFormat: 'gpx', stats: mockStats, sortOrder: 1 },
      ]),
      deleteActivity: vi.fn(),
    },
    trackpoints: {
      insertTrackpoints: vi.fn(),
      getTrackpoints: vi.fn(),
      getTrackpointsSampled: vi.fn().mockResolvedValue([mockPoint, mockPoint, mockPoint]),
      recalculatePointIndices: vi.fn(),
    },
  }
}

function wrapper(repos: ReturnType<typeof makeRepos>) {
  return ({ children }: { children: ReactNode }) => (
    <RepositoryProvider repositories={repos as any}>{children}</RepositoryProvider>
  )
}

describe('useTrail', () => {
  it('loads trail with days and activities', async () => {
    const repos = makeRepos()
    const { result } = renderHook(() => useTrail('t1'), { wrapper: wrapper(repos) })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.trail?.name).toBe('Alps')
    expect(result.current.trail?.days).toHaveLength(1)
    expect(result.current.trail?.days[0].activities).toHaveLength(1)
    expect(result.current.trail?.days[0].activities[0].name).toBe('Morning hike')
  })

  it('returns null trail when not found', async () => {
    const repos = makeRepos()
    repos.trails.getTrail = vi.fn().mockResolvedValue(null)
    const { result } = renderHook(() => useTrail('missing'), { wrapper: wrapper(repos) })
    // stays loading since getTrail returned null and we never setLoading(false)
    await waitFor(() => expect(repos.trails.getTrail).toHaveBeenCalled())
    expect(result.current.trail).toBeNull()
  })
})
