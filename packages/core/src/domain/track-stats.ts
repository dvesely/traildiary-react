import type { TrackPoint } from './trackpoint.js'

export interface TrackStats {
  distance: number
  elevationGain: number
  elevationLoss: number
  duration: number
  movingTime: number
  avgSpeed: number
  startTime: number
  endTime: number
}

const EARTH_RADIUS_KM = 6371

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function haversineDistance(a: TrackPoint, b: TrackPoint): number {
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const sinLat = Math.sin(dLat / 2)
  const sinLon = Math.sin(dLon / 2)
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLon * sinLon
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

function smoothElevations(points: TrackPoint[], windowSize: number = 5): number[] {
  const elevations = points.map((p) => p.elevation)
  const half = Math.floor(windowSize / 2)
  return elevations.map((_, i) => {
    const start = Math.max(0, i - half)
    const end = Math.min(elevations.length - 1, i + half)
    let sum = 0
    for (let j = start; j <= end; j++) sum += elevations[j]
    return sum / (end - start + 1)
  })
}

const MOVING_SPEED_THRESHOLD_KMH = 0.5

export function computeStats(points: TrackPoint[]): TrackStats {
  if (points.length === 0) {
    return {
      distance: 0, elevationGain: 0, elevationLoss: 0,
      duration: 0, movingTime: 0, avgSpeed: 0,
      startTime: 0, endTime: 0,
    }
  }

  let distance = 0
  let movingTime = 0
  const smoothed = smoothElevations(points)
  let elevationGain = 0
  let elevationLoss = 0

  for (let i = 1; i < points.length; i++) {
    const d = haversineDistance(points[i - 1], points[i])
    distance += d

    const dt = points[i].timestamp - points[i - 1].timestamp
    if (dt > 0) {
      const speedKmh = (d / dt) * 3_600_000
      if (speedKmh > MOVING_SPEED_THRESHOLD_KMH) {
        movingTime += dt
      }
    }

    const elevDiff = smoothed[i] - smoothed[i - 1]
    if (elevDiff > 0) elevationGain += elevDiff
    else elevationLoss += Math.abs(elevDiff)
  }

  const duration = points[points.length - 1].timestamp - points[0].timestamp
  const avgSpeed = movingTime > 0 ? (distance / movingTime) * 3_600_000 : 0

  return {
    distance,
    elevationGain,
    elevationLoss,
    duration,
    movingTime,
    avgSpeed,
    startTime: points[0].timestamp,
    endTime: points[points.length - 1].timestamp,
  }
}

export function aggregateStats(statsList: TrackStats[]): TrackStats {
  if (statsList.length === 0) {
    return {
      distance: 0, elevationGain: 0, elevationLoss: 0,
      duration: 0, movingTime: 0, avgSpeed: 0,
      startTime: 0, endTime: 0,
    }
  }

  const result = statsList.reduce(
    (acc, s) => ({
      distance: acc.distance + s.distance,
      elevationGain: acc.elevationGain + s.elevationGain,
      elevationLoss: acc.elevationLoss + s.elevationLoss,
      duration: acc.duration + s.duration,
      movingTime: acc.movingTime + s.movingTime,
      avgSpeed: 0,
      startTime: Math.min(acc.startTime, s.startTime),
      endTime: Math.max(acc.endTime, s.endTime),
    }),
    { distance: 0, elevationGain: 0, elevationLoss: 0, duration: 0, movingTime: 0, avgSpeed: 0, startTime: Infinity, endTime: 0 },
  )

  result.avgSpeed = result.movingTime > 0 ? (result.distance / result.movingTime) * 3_600_000 : 0
  return result
}
