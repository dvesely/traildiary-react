import { View, Text, StyleSheet } from 'react-native'
import type { TrackStats } from '@traildiary/core'

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3_600_000)
  const minutes = Math.floor((ms % 3_600_000) / 60_000)
  return `${hours}h ${minutes}m`
}

interface StatsPanelProps {
  stats: TrackStats
  label: string
}

export function StatsPanel({ stats, label }: StatsPanelProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Text style={styles.stat}>{stats.distance.toFixed(1)} km</Text>
        <Text style={styles.gain}>+{Math.round(stats.elevationGain)} m</Text>
        <Text style={styles.loss}>-{Math.round(stats.elevationLoss)} m</Text>
        <Text style={styles.stat}>{formatDuration(stats.duration)}</Text>
        <Text style={styles.stat}>{stats.avgSpeed.toFixed(1)} km/h</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#111' },
  label: { color: '#d1d5db', fontWeight: '600', fontSize: 13, marginBottom: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { color: '#9ca3af', fontSize: 13 },
  gain: { color: '#4ade80', fontSize: 13 },
  loss: { color: '#f87171', fontSize: 13 },
})
