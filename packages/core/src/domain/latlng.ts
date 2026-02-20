export interface LatLng {
  lat: number
  lon: number
}

export function latLngFromPoint({
  lat,
  lon,
}: {
  lat: number
  lon: number
}): LatLng {
  return { lat, lon }
}

export function createLatLng(lat: number, lon: number): LatLng {
  return { lat, lon }
}
