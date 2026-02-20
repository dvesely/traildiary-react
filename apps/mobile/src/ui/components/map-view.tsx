import { useEffect, useRef } from 'react'
import { StyleSheet } from 'react-native'
import MapView, { Polyline, Marker } from 'react-native-maps'
import { simplifyPointsForZoom } from '@traildiary/core'
import type { TrailDayView } from '@traildiary/ui'
import type { TrackPoint } from '@traildiary/core'

const DAY_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6',
]

interface TrailMapViewProps {
  days: TrailDayView[]
  selectedDayId: string | null
  hoveredPoint?: TrackPoint | null
}

export function TrailMapView({ days, selectedDayId, hoveredPoint }: TrailMapViewProps) {
  const mapRef = useRef<MapView>(null)

  const visibleDays = selectedDayId ? days.filter((d) => d.id === selectedDayId) : days

  useEffect(() => {
    if (!mapRef.current || days.length === 0) return
    const allPoints = visibleDays.flatMap((d) =>
      d.activities.flatMap((a) => a.simplifiedPoints)
    )
    if (allPoints.length === 0) return
    mapRef.current.fitToCoordinates(
      allPoints.map((p) => ({ latitude: p.lat, longitude: p.lon })),
      { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: true }
    )
  }, [days, selectedDayId])

  return (
    <MapView ref={mapRef} style={styles.map} mapType="terrain">
      {visibleDays.map((day, i) => {
        const color = selectedDayId ? DAY_COLORS[0] : DAY_COLORS[i % DAY_COLORS.length]
        const coords = day.activities
          .flatMap((a) => simplifyPointsForZoom(a.simplifiedPoints, 12))
          .map((p) => ({ latitude: p.lat, longitude: p.lon }))
        if (coords.length === 0) return null
        return (
          <Polyline
            key={day.id}
            coordinates={coords}
            strokeColor={color}
            strokeWidth={3}
          />
        )
      })}

      {hoveredPoint && (
        <Marker
          coordinate={{ latitude: hoveredPoint.lat, longitude: hoveredPoint.lon }}
          anchor={{ x: 0.5, y: 0.5 }}
          flat
        />
      )}
    </MapView>
  )
}

const styles = StyleSheet.create({
  map: { flex: 1 },
})
