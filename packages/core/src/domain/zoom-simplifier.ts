import { simplifyTrack } from './track-simplifier.js'
import type { TrackPoint } from './trackpoint.js'

/**
 * Returns RDP tolerance in degrees for a given map zoom level.
 * Returns null at high zoom (≥14) to use points as-is (already pre-simplified).
 */
export function toleranceForZoom(zoom: number): number | null {
  if (zoom < 6) return 0.05
  if (zoom < 8) return 0.01
  if (zoom < 10) return 0.003
  if (zoom < 12) return 0.001
  if (zoom < 14) return 0.0003
  return null
}

/**
 * Returns a zoom-appropriate subset of points using RDP simplification.
 * At zoom ≥14 the input array is returned unchanged.
 */
export function simplifyPointsForZoom(points: TrackPoint[], zoom: number): TrackPoint[] {
  const tolerance = toleranceForZoom(zoom)
  return tolerance !== null ? simplifyTrack(points, tolerance) : points
}
