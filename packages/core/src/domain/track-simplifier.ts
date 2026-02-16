import type { TrackPoint } from './trackpoint.js'

function perpendicularDistance(point: TrackPoint, lineStart: TrackPoint, lineEnd: TrackPoint): number {
  const dx = lineEnd.lat - lineStart.lat
  const dy = lineEnd.lon - lineStart.lon

  if (dx === 0 && dy === 0) {
    const pdx = point.lat - lineStart.lat
    const pdy = point.lon - lineStart.lon
    return Math.sqrt(pdx * pdx + pdy * pdy)
  }

  const t = ((point.lat - lineStart.lat) * dx + (point.lon - lineStart.lon) * dy) / (dx * dx + dy * dy)
  const closestLat = lineStart.lat + t * dx
  const closestLon = lineStart.lon + t * dy
  const pdx = point.lat - closestLat
  const pdy = point.lon - closestLon
  return Math.sqrt(pdx * pdx + pdy * pdy)
}

export function simplifyTrack(points: TrackPoint[], tolerance: number): TrackPoint[] {
  if (points.length <= 2) return points

  let maxDist = 0
  let maxIdx = 0

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[points.length - 1])
    if (dist > maxDist) {
      maxDist = dist
      maxIdx = i
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyTrack(points.slice(0, maxIdx + 1), tolerance)
    const right = simplifyTrack(points.slice(maxIdx), tolerance)
    return [...left.slice(0, -1), ...right]
  }

  return [points[0], points[points.length - 1]]
}
