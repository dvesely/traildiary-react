import { describe, it, expect } from 'vitest'
import { findNearestPoint } from '../../domain/find-nearest-point.js'
import type { TrackPoint } from '../../domain/trackpoint.js'

function makePoint(lat: number, lon: number, elevation = 0, timestamp = 0): TrackPoint {
  return { lat, lon, elevation, timestamp }
}

describe('findNearestPoint', () => {
  it('returns null for empty array', () => {
    expect(findNearestPoint([], 50.0, 14.0)).toBeNull()
  })

  it('returns the single point when array has one entry', () => {
    const p = makePoint(50.0, 14.0)
    expect(findNearestPoint([p], 50.0, 14.0)).toBe(p)
  })

  it('returns the closest point by haversine distance', () => {
    const near = makePoint(50.0, 14.0)
    const far = makePoint(51.0, 15.0)
    expect(findNearestPoint([near, far], 50.001, 14.001)).toBe(near)
    expect(findNearestPoint([near, far], 50.999, 14.999)).toBe(far)
  })

  it('returns the first point when two points are equidistant', () => {
    const first = makePoint(50.0, 14.0)
    const second = makePoint(50.0, 14.002)
    // query at midpoint lon 14.001 — equidistant from both
    expect(findNearestPoint([first, second], 50.0, 14.001)).toBe(first)
  })

  it('finds closest point on a line segment between two points', () => {
    const p1 = makePoint(50.0, 14.0)
    const p2 = makePoint(50.0, 14.002)
    const result = findNearestPoint([p1, p2], 50.001, 14.001)
    // Should be somewhere between p1 and p2, not exactly either point
    expect(result).not.toBe(p1)
    expect(result).not.toBe(p2)
    expect(result!.lat).toBeCloseTo(50.0, 2)
    expect(result!.lon).toBeCloseTo(14.001, 3)
  })

  it('interpolates elevation on line segment', () => {
    const p1 = makePoint(50.0, 14.0, 100, 0)
    const p2 = makePoint(50.0, 14.002, 200, 10)
    const result = findNearestPoint([p1, p2], 50.0, 14.001)
    // Should interpolate elevation at approximately the midpoint
    expect(result!.elevation).toBeCloseTo(150, 0)
  })

  it('interpolates timestamp on line segment', () => {
    const p1 = makePoint(50.0, 14.0, 0, 0)
    const p2 = makePoint(50.0, 14.002, 0, 100)
    const result = findNearestPoint([p1, p2], 50.0, 14.001)
    // Should interpolate timestamp at approximately the midpoint
    expect(result!.timestamp).toBeCloseTo(50, 0)
  })
})
