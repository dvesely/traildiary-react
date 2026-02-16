import { describe, it, expect } from 'vitest'
import { downsampleForChart } from '../../domain/track-downsampler.js'
import type { TrackPoint } from '../../domain/trackpoint.js'

function makePoints(count: number): TrackPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    lat: 50 + i * 0.001,
    lon: 14,
    elevation: Math.sin(i / 10) * 100 + 500,
    timestamp: i * 1000,
  }))
}

describe('downsampleForChart', () => {
  it('returns original if count <= target', () => {
    const points = makePoints(10)
    expect(downsampleForChart(points, 20)).toEqual(points)
  })

  it('reduces to target count', () => {
    const points = makePoints(1000)
    const result = downsampleForChart(points, 100)
    expect(result.length).toBe(100)
  })

  it('preserves first and last points', () => {
    const points = makePoints(500)
    const result = downsampleForChart(points, 50)
    expect(result[0]).toEqual(points[0])
    expect(result[result.length - 1]).toEqual(points[points.length - 1])
  })
})
