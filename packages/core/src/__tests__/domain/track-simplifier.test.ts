import { describe, it, expect } from 'vitest'
import { simplifyTrack } from '../../domain/track-simplifier.js'
import type { TrackPoint } from '../../domain/trackpoint.js'

function makePoint(lat: number, lon: number): TrackPoint {
  return { lat, lon, elevation: 0, timestamp: 0 }
}

describe('simplifyTrack', () => {
  it('keeps start and end points', () => {
    const points = [makePoint(0, 0), makePoint(0.0001, 0), makePoint(1, 0)]
    const result = simplifyTrack(points, 0.001)
    expect(result[0]).toEqual(points[0])
    expect(result[result.length - 1]).toEqual(points[points.length - 1])
  })

  it('removes collinear points', () => {
    const points = [makePoint(0, 0), makePoint(0.5, 0), makePoint(1, 0)]
    const result = simplifyTrack(points, 0.01)
    expect(result.length).toBe(2)
  })

  it('keeps points that deviate from the line', () => {
    const points = [makePoint(0, 0), makePoint(0.5, 1), makePoint(1, 0)]
    const result = simplifyTrack(points, 0.01)
    expect(result.length).toBe(3)
  })

  it('returns original if 2 or fewer points', () => {
    const points = [makePoint(0, 0), makePoint(1, 1)]
    expect(simplifyTrack(points, 0.01)).toEqual(points)
  })
})
