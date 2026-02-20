import { findNearestPoint, simplifyPointsForZoom, type TrackPoint } from '@traildiary/core'
import maplibregl from 'maplibre-gl'
import { useEffect, useRef } from 'react'
import type { TrailDayView } from '../../application/hooks/use-trail.js'

interface MapViewProps {
  days: TrailDayView[]
  selectedDayId: string | null
  hoveredPoint?: TrackPoint | null
  chartPoints?: TrackPoint[]
  onHoverPoint?: (point: TrackPoint | null) => void
}

const DAY_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f43f5e',
  '#14b8a6',
]

function getCoords(day: TrailDayView, zoom: number): [number, number][] {
  return day.activities.flatMap((a) =>
    simplifyPointsForZoom(a.simplifiedPoints, zoom).map((p) => [p.lon, p.lat] as [number, number]),
  )
}

export function MapView({
  days,
  selectedDayId,
  hoveredPoint,
  chartPoints,
  onHoverPoint,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  const daysRef = useRef<TrailDayView[]>(days)
  const chartPointsRef = useRef<TrackPoint[]>(chartPoints ?? [])
  const onHoverPointRef = useRef(onHoverPoint)
  const rafIdRef = useRef<number | null>(null)

  useEffect(() => {
    daysRef.current = days
  }, [days])
  useEffect(() => {
    chartPointsRef.current = chartPoints ?? []
  }, [chartPoints])
  useEffect(() => {
    onHoverPointRef.current = onHoverPoint
  }, [onHoverPoint])

  useEffect(() => {
    if (!containerRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [0, 0],
      zoom: 2,
    })

    map.addControl(new maplibregl.NavigationControl())

    map.on('load', () => {
      map.addSource('hover-point', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'hover-point-circle',
        type: 'circle',
        source: 'hover-point',
        paint: {
          'circle-radius': 6,
          'circle-color': '#ffffff',
          'circle-stroke-color': '#3b82f6',
          'circle-stroke-width': 2,
        },
      })

      map.on('mousemove', (e) => {
        const pts = chartPointsRef.current
        if (pts.length === 0) return
        if (rafIdRef.current !== null) return
        const { lat, lng } = e.lngLat
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null
          const nearest = findNearestPoint(pts, lat, lng)
          onHoverPointRef.current?.(nearest)
        })
      })

      map.on('mouseout', () => {
        onHoverPointRef.current?.(null)
      })

      map.on('zoomend', () => {
        const zoom = map.getZoom()
        for (const day of daysRef.current) {
          const source = map.getSource(`day-${day.id}`) as maplibregl.GeoJSONSource | undefined
          if (!source) continue
          const coords = getCoords(day, zoom)
          if (coords.length === 0) continue
          source.setData({
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: coords },
          })
        }
      })
    })

    mapRef.current = map

    return () => map.remove()
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || days.length === 0) return

    function addLayers() {
      const bounds = new maplibregl.LngLatBounds()
      const zoom = map!.getZoom()

      days.forEach((day, i) => {
        const sourceId = `day-${day.id}`
        const layerId = `day-line-${day.id}`
        const color = DAY_COLORS[i % DAY_COLORS.length]

        const coords = getCoords(day, zoom)

        if (coords.length === 0) return
        coords.forEach((c) => bounds.extend(c))

        if (map?.getSource(sourceId)) {
          ;(map?.getSource(sourceId) as maplibregl.GeoJSONSource).setData({
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: coords },
          })
        } else {
          map?.addSource(sourceId, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: coords },
            },
          })

          map?.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            paint: {
              'line-color': color,
              'line-width':
                selectedDayId === null || selectedDayId === day.id ? 3 : 1,
              'line-opacity':
                selectedDayId === null || selectedDayId === day.id ? 1 : 0.3,
            },
          })
        }
      })

      // Ensure hover dot renders on top of all trail lines
      if (map?.getLayer('hover-point-circle')) {
        map?.moveLayer('hover-point-circle')
      }

      if (!bounds.isEmpty()) {
        map?.fitBounds(bounds, { padding: 50 })
      }
    }

    if (map.isStyleLoaded()) {
      addLayers()
    } else {
      map.on('load', addLayers)
    }
  }, [days, selectedDayId])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return

    const source = map.getSource('hover-point') as
      | maplibregl.GeoJSONSource
      | undefined
    if (!source) return

    if (hoveredPoint) {
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: [hoveredPoint.lon, hoveredPoint.lat],
        },
      })
    } else {
      source.setData({ type: 'FeatureCollection', features: [] })
    }
  }, [hoveredPoint])

  return <div ref={containerRef} className="w-full h-full" />
}
