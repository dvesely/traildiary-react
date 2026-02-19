import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import type { TrailDayView } from '../../application/hooks/use-trail.js'
import type { TrackPoint } from '@traildiary/core'

interface MapViewProps {
  days: TrailDayView[]
  selectedDayId: string | null
  hoveredPoint?: TrackPoint | null
}

const DAY_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6',
]

export function MapView({ days, selectedDayId, hoveredPoint }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

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
    })

    mapRef.current = map

    return () => map.remove()
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || days.length === 0) return

    function addLayers() {
      const bounds = new maplibregl.LngLatBounds()

      days.forEach((day, i) => {
        const sourceId = `day-${day.id}`
        const layerId = `day-line-${day.id}`
        const color = DAY_COLORS[i % DAY_COLORS.length]

        const coords = day.activities.flatMap((a) =>
          a.simplifiedPoints.map((p) => [p.lon, p.lat] as [number, number])
        )

        if (coords.length === 0) return
        coords.forEach((c) => bounds.extend(c))

        if (map!.getSource(sourceId)) {
          (map!.getSource(sourceId) as maplibregl.GeoJSONSource).setData({
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: coords },
          })
        } else {
          map!.addSource(sourceId, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: coords },
            },
          })

          map!.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            paint: {
              'line-color': color,
              'line-width': selectedDayId === null || selectedDayId === day.id ? 3 : 1,
              'line-opacity': selectedDayId === null || selectedDayId === day.id ? 1 : 0.3,
            },
          })
        }
      })

      if (!bounds.isEmpty()) {
        map!.fitBounds(bounds, { padding: 50 })
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

    const source = map.getSource('hover-point') as maplibregl.GeoJSONSource | undefined
    if (!source) return

    if (hoveredPoint) {
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: [hoveredPoint.lon, hoveredPoint.lat] },
      })
    } else {
      source.setData({ type: 'FeatureCollection', features: [] })
    }
  }, [hoveredPoint])

  return <div ref={containerRef} className="w-full h-full" />
}
