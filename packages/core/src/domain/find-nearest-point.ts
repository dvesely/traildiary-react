import { haversineDistance } from './track-stats.js'
import type { TrackPoint } from './trackpoint.js'

export function findNearestPoint(points: TrackPoint[], lat: number, lon: number): TrackPoint | null {
  if (points.length === 0) return null
  const cursor: TrackPoint = { lat, lon, elevation: 0, timestamp: 0 }
  let nearest = points[0]
  let minDist = haversineDistance(cursor, nearest)
  for (let i = 1; i < points.length; i++) {
    const d = haversineDistance(cursor, points[i])
    if (d < minDist) {
      minDist = d
      nearest = points[i]
    }
  }
  return nearest
}
