import type { LatLng } from './latlng'

export function calcDistance(point1: LatLng, point2: LatLng): number {
  // FIXME: use projection than Geo
  const R = 6371 // Earth's mean radius in km

  // Convert degrees to radians
  const toRad = (value: number) => (value * Math.PI) / 180

  const dLat = toRad(point2.lat - point1.lat)
  const dLon = toRad(point2.lon - point1.lon)

  const lat1 = toRad(point1.lat)
  const lat2 = toRad(point2.lat)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}
