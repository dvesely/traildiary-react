import { describe, it, expect } from 'vitest'
import { findNearestPoint } from '../../domain/find-nearest-point.js'
import type { TrackPoint } from '../../domain/trackpoint.js'

function pt(lat: number, lon: number): TrackPoint {
  return { lat, lon, elevation: 0, timestamp: 0 }
}

describe('findNearestPoint', () => {
  it('returns null for empty array', () => {
    expect(findNearestPoint([], 50.0, 14.0)).toBeNull()
  })

  it('returns the single point when array has one entry', () => {
    const p = pt(50.0, 14.0)
    expect(findNearestPoint([p], 50.0, 14.0)).toBe(p)
  })

  it('returns the closest point by haversine distance', () => {
    const near = pt(50.0, 14.0)
    const far = pt(51.0, 15.0)
    expect(findNearestPoint([near, far], 50.001, 14.001)).toBe(near)
    expect(findNearestPoint([near, far], 50.999, 14.999)).toBe(far)
  })
})
