import type { TrackPoint } from './trackpoint.js'

export function validateActivityTimestamps(points: TrackPoint[]): boolean {
  return points.length > 0 && points.every((p) => p.timestamp !== 0)
}
