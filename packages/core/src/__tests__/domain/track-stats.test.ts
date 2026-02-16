import { describe, it, expect } from 'vitest'
import { haversineDistance, computeStats, aggregateStats } from '../../domain/track-stats.js'
import type { TrackPoint } from '../../domain/trackpoint.js'

function makePoint(lat: number, lon: number, elevation: number, timestamp: number): TrackPoint {
  return { lat, lon, elevation, timestamp }
}

describe('haversineDistance', () => {
  it('returns 0 for same point', () => {
    const p = makePoint(50.0, 14.0, 200, 0)
    expect(haversineDistance(p, p)).toBe(0)
  })

  it('calculates known distance between Prague and Brno (~186km)', () => {
    const prague = makePoint(50.0755, 14.4378, 200, 0)
    const brno = makePoint(49.1951, 16.6068, 200, 0)
    const dist = haversineDistance(prague, brno)
    expect(dist).toBeGreaterThan(180)
    expect(dist).toBeLessThan(190)
  })
})

describe('computeStats', () => {
  it('returns zeros for empty points', () => {
    const stats = computeStats([])
    expect(stats.distance).toBe(0)
    expect(stats.elevationGain).toBe(0)
    expect(stats.duration).toBe(0)
  })

  it('computes distance for a simple track', () => {
    const points = [
      makePoint(50.0, 14.0, 200, 1000),
      makePoint(50.001, 14.0, 220, 2000),
      makePoint(50.002, 14.0, 240, 3000),
      makePoint(50.003, 14.0, 260, 4000),
      makePoint(50.004, 14.0, 280, 5000),
      makePoint(50.005, 14.0, 300, 6000),
    ]
    const stats = computeStats(points)
    expect(stats.distance).toBeGreaterThan(0)
    expect(stats.elevationGain).toBeGreaterThan(0)
    expect(stats.duration).toBe(5000)
    expect(stats.startTime).toBe(1000)
    expect(stats.endTime).toBe(6000)
  })
})

describe('aggregateStats', () => {
  it('sums distances and elevations', () => {
    const s1 = { distance: 10, elevationGain: 500, elevationLoss: 300, duration: 3600000, movingTime: 3000000, avgSpeed: 12, startTime: 1000, endTime: 3601000 }
    const s2 = { distance: 15, elevationGain: 800, elevationLoss: 600, duration: 5400000, movingTime: 4500000, avgSpeed: 12, startTime: 4000000, endTime: 9400000 }
    const agg = aggregateStats([s1, s2])
    expect(agg.distance).toBe(25)
    expect(agg.elevationGain).toBe(1300)
    expect(agg.startTime).toBe(1000)
    expect(agg.endTime).toBe(9400000)
  })
})
