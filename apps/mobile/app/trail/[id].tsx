import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import type { TrackPoint } from '@traildiary/core'
import { useTrail } from '@traildiary/ui'
import { TrailMapView } from '../../src/ui/components/map-view'
import { ElevationChart } from '../../src/ui/components/elevation-chart'
import { StatsPanel } from '../../src/ui/components/stats-panel'
import { DayList } from '../../src/ui/components/day-list'

export default function TrailDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { trail, loading } = useTrail(id)
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null)
  const [hoveredPoint, setHoveredPoint] = useState<TrackPoint | null>(null)

  if (loading || !trail) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#3b82f6" />
        {!loading && !trail && <Text style={styles.muted}>Trail not found</Text>}
      </View>
    )
  }

  const selectedDay = selectedDayId ? trail.days.find((d) => d.id === selectedDayId) : null
  const currentStats = selectedDay ? selectedDay.stats : trail.stats
  const currentLabel = selectedDay ? selectedDay.name : 'Trail total'

  const visibleDays = selectedDay ? [selectedDay] : trail.days
  const elevationPoints = visibleDays
    .flatMap((d) => d.activities.flatMap((a) => a.simplifiedPoints))
    .map((p, i) => ({ ...p, index: i }))

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        <TrailMapView
          days={trail.days}
          selectedDayId={selectedDayId}
          hoveredPoint={hoveredPoint}
        />
      </View>

      <DayList
        trail={trail}
        selectedDayId={selectedDayId}
        onSelectDay={(dayId) => {
          setSelectedDayId(dayId)
          setHoveredPoint(null)
        }}
      />

      <View style={styles.chartContainer}>
        <ElevationChart
          points={elevationPoints}
          height={140}
          hoveredPoint={hoveredPoint}
        />
      </View>

      <View style={styles.statsContainer}>
        <StatsPanel stats={currentStats} label={currentLabel} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111', gap: 8 },
  muted: { color: '#9ca3af', fontSize: 14 },
  mapContainer: { flex: 1 },
  chartContainer: { borderTopWidth: 1, borderTopColor: '#1f2937' },
  statsContainer: { borderTopWidth: 1, borderTopColor: '#1f2937' },
})
