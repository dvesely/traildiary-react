import type { TrackPoint } from './trackpoint.js'

export function downsampleForChart(points: TrackPoint[], targetCount: number): TrackPoint[] {
  if (points.length <= targetCount) return points

  const sampled: TrackPoint[] = [points[0]]
  const bucketSize = (points.length - 2) / (targetCount - 2)

  let prevIndex = 0

  for (let i = 0; i < targetCount - 2; i++) {
    const bucketStart = Math.floor((i + 1) * bucketSize) + 1
    const bucketEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, points.length - 1)

    let avgLat = 0
    let avgElevation = 0
    const nextBucketCount = bucketEnd - bucketStart
    for (let j = bucketStart; j < bucketEnd; j++) {
      avgLat += points[j].lat
      avgElevation += points[j].elevation
    }
    avgLat /= nextBucketCount || 1
    avgElevation /= nextBucketCount || 1

    const rangeStart = Math.floor(i * bucketSize) + 1
    const rangeEnd = Math.floor((i + 1) * bucketSize) + 1

    let maxArea = -1
    let maxIdx = rangeStart

    const prevPoint = points[prevIndex]

    for (let j = rangeStart; j < rangeEnd && j < points.length - 1; j++) {
      const area = Math.abs(
        (prevPoint.lat - avgLat) * (points[j].elevation - prevPoint.elevation) -
        (prevPoint.lat - points[j].lat) * (avgElevation - prevPoint.elevation)
      )
      if (area > maxArea) {
        maxArea = area
        maxIdx = j
      }
    }

    sampled.push(points[maxIdx])
    prevIndex = maxIdx
  }

  sampled.push(points[points.length - 1])
  return sampled
}
