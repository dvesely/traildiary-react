import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { RepositoryProvider } from '../../contexts/repository-context.js'
import { useImport } from '../../hooks/use-import.js'
import { GpxParser } from '@traildiary/core'

const gpxXml = `<?xml version="1.0"?><gpx version="1.1"><trk><name>Test</name><trkseg>
  <trkpt lat="47.0" lon="13.0"><ele>1000</ele><time>2024-01-01T08:00:00Z</time></trkpt>
  <trkpt lat="47.1" lon="13.1"><ele>1100</ele><time>2024-01-01T09:00:00Z</time></trkpt>
</trkseg></trk></gpx>`

function makeRepos() {
  return {
    trails: {
      createTrail: vi.fn().mockResolvedValue('new-trail-id'),
      getTrail: vi.fn(),
      listTrails: vi.fn(),
      listTrailSummaries: vi.fn(),
      deleteTrail: vi.fn(),
    },
    trailDays: {
      createTrailDay: vi.fn().mockResolvedValue('day-1'),
      getTrailDays: vi.fn().mockResolvedValue([]),
      deleteTrailDay: vi.fn(),
    },
    activities: {
      createActivity: vi.fn().mockResolvedValue('act-1'),
      getActivities: vi.fn(),
      deleteActivity: vi.fn(),
    },
    trackpoints: {
      insertTrackpoints: vi.fn().mockResolvedValue(undefined),
      getTrackpoints: vi.fn(),
      getTrackpointsSampled: vi.fn(),
      recalculatePointIndices: vi.fn(),
    },
  }
}

function wrapper(repos: ReturnType<typeof makeRepos>) {
  return ({ children }: { children: ReactNode }) => (
    <RepositoryProvider repositories={repos as any}>{children}</RepositoryProvider>
  )
}

describe('useImport', () => {
  it('imports files and returns trailId when done', async () => {
    const repos = makeRepos()
    const parsers = [new GpxParser()]
    const { result } = renderHook(() => useImport(parsers), { wrapper: wrapper(repos) })

    const buf = new TextEncoder().encode(gpxXml).buffer
    let trailId: string | null = null

    await act(async () => {
      trailId = await result.current.importFiles('My Trail', [{ name: 'test.gpx', data: buf }])
    })

    expect(trailId).toBe('new-trail-id')
    expect(repos.trails.createTrail).toHaveBeenCalledWith('My Trail')
    expect(repos.trailDays.createTrailDay).toHaveBeenCalled()
    expect(repos.trackpoints.insertTrackpoints).toHaveBeenCalled()
    expect(result.current.progress.status).toBe('done')
  })

  it('skips files with no matching parser', async () => {
    const repos = makeRepos()
    const parsers = [new GpxParser()]
    const { result } = renderHook(() => useImport(parsers), { wrapper: wrapper(repos) })

    await act(async () => {
      await result.current.importFiles('Trail', [{ name: 'unknown.xyz', data: new ArrayBuffer(0) }])
    })

    expect(repos.trailDays.createTrailDay).not.toHaveBeenCalled()
  })
})
