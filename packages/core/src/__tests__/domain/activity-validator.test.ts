import { describe, it, expect } from 'vitest'
import { validateActivityTimestamps } from '../../domain/activity-validator.js'
import type { TrackPoint } from '../../domain/trackpoint.js'

function makePoint(timestamp: number): TrackPoint {
  return { lat: 50.0, lon: 14.0, elevation: 200, timestamp }
}

describe('validateActivityTimestamps', () => {
  it('returns true when all points have non-zero timestamps', () => {
    const points = [makePoint(1000), makePoint(2000), makePoint(3000)]
    expect(validateActivityTimestamps(points)).toBe(true)
  })

  it('returns false when any point has timestamp === 0', () => {
    const points = [makePoint(1000), makePoint(0), makePoint(3000)]
    expect(validateActivityTimestamps(points)).toBe(false)
  })

  it('returns false when all points have timestamp === 0', () => {
    const points = [makePoint(0), makePoint(0)]
    expect(validateActivityTimestamps(points)).toBe(false)
  })

  it('returns false for empty points array', () => {
    expect(validateActivityTimestamps([])).toBe(false)
  })
})
