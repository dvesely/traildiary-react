import { haversineDistance } from './track-stats.js'
import type { TrackPoint } from './trackpoint.js'

/**
 * Calculates the closest point on a line segment between two points A and B.
 * Uses projection math to find the perpendicular foot on the segment.
 */
function findClosestPointOnSegment(
  cursor: TrackPoint,
  pointA: TrackPoint,
  pointB: TrackPoint,
): { point: TrackPoint; distance: number } {
  // Convert lat/lon to radians
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const toDeg = (rad: number) => (rad * 180) / Math.PI

  // Use equirectangular approximation for short distances
  const lat1 = toRad(pointA.lat)
  const lat2 = toRad(pointB.lat)
  const lon1 = toRad(pointA.lon)
  const lon2 = toRad(pointB.lon)
  const latC = toRad(cursor.lat)
  const lonC = toRad(cursor.lon)

  const cosLatMid = Math.cos((lat1 + lat2) / 2)

  // Convert to local x,y coordinates
  const x1 = (lon1 - lonC) * cosLatMid
  const y1 = lat1 - latC
  const x2 = (lon2 - lonC) * cosLatMid
  const y2 = lat2 - latC
  const x0 = 0
  const y0 = 0

  // Vector from A to B
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy

  // Clamp t to [0, 1] to find point on segment (not extended line)
  let t = (x0 - x1) * dx + (y0 - y1) * dy
  if (len2 > 0) t /= len2
  t = Math.max(0, Math.min(1, t))

  // Closest point on segment
  const closestX = x1 + t * dx
  const closestY = y1 + t * dy

  // Convert back to lat/lon
  const closestLat = toDeg(latC + closestY)
  const closestLon = toDeg(lonC + closestX / cosLatMid)

  // Interpolate elevation
  const closestElevation =
    pointA.elevation + (pointB.elevation - pointA.elevation) * t
  const closestTimestamp =
    pointA.timestamp + (pointB.timestamp - pointA.timestamp) * t

  const closestDistance =
    pointA.distance + (pointB.distance - pointA.distance) * t

  const point: TrackPoint = {
    lat: closestLat,
    lon: closestLon,
    elevation: closestElevation,
    timestamp: closestTimestamp,
    distance: closestDistance,
    index: t < 0.5 ? pointA.index : pointB.index,
  }

  const distance = Math.sqrt(closestX * closestX + closestY * closestY)
  return { point, distance }
}

export function findNearestPoint(
  points: TrackPoint[],
  lat: number,
  lon: number,
): TrackPoint | null {
  if (points.length === 0) return null

  const cursor: TrackPoint = {
    lat,
    lon,
    elevation: 0,
    timestamp: 0,
    distance: 0,
    index: 0, // FIXME: maybe use different struct?
  }
  let nearest = points[0]
  let minDist = haversineDistance(cursor, nearest)

  // Check against all points
  for (let i = 1; i < points.length; i++) {
    const d = haversineDistance(cursor, points[i])
    if (d < minDist) {
      minDist = d
      nearest = points[i]
    }
  }

  // Check against all line segments between consecutive points
  for (let i = 0; i < points.length - 1; i++) {
    const result = findClosestPointOnSegment(cursor, points[i], points[i + 1])
    if (result.distance < minDist) {
      minDist = result.distance
      nearest = result.point
    }
  }

  return nearest
}

export function findPointByDistance(
  // FIXME: return point on polygon not from dataset
  data: TrackPoint[],
  targetDistance: number,
): TrackPoint {
  let low = 0
  let high = data.length - 1

  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    if (data[mid].distance < targetDistance) {
      low = mid + 1
    } else {
      high = mid
    }
  }

  // Check if the previous neighbor is actually closer
  if (
    low > 0 &&
    Math.abs(data[low - 1].distance - targetDistance) <
      Math.abs(data[low].distance - targetDistance)
  ) {
    return data[low - 1]
  }
  return data[low]
}
