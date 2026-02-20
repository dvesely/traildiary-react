import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import type { TrailView, TrailDayView } from '@traildiary/ui'

interface DayListProps {
  trail: TrailView
  selectedDayId: string | null
  onSelectDay: (dayId: string | null) => void
  onRemoveDay?: (dayId: string) => void
}

export function DayList({ trail, selectedDayId, onSelectDay, onRemoveDay }: DayListProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.content}>
      <TouchableOpacity
        style={[styles.chip, selectedDayId === null && styles.chipSelected]}
        onPress={() => onSelectDay(null)}
      >
        <Text style={[styles.chipText, selectedDayId === null && styles.chipTextSelected]}>
          All
        </Text>
        <Text style={styles.chipSub}>
          {trail.stats.distance.toFixed(1)} km
        </Text>
      </TouchableOpacity>

      {trail.days.map((day) => (
        <TouchableOpacity
          key={day.id}
          style={[styles.chip, selectedDayId === day.id && styles.chipSelected]}
          onPress={() => onSelectDay(day.id)}
          onLongPress={() => onRemoveDay?.(day.id)}
        >
          <Text style={[styles.chipText, selectedDayId === day.id && styles.chipTextSelected]}>
            {day.name}
          </Text>
          <Text style={styles.chipSub}>
            {day.stats.distance.toFixed(1)} km
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  content: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#1f2937',
    alignItems: 'center',
  },
  chipSelected: { backgroundColor: '#3b82f6' },
  chipText: { color: '#9ca3af', fontSize: 13, fontWeight: '600' },
  chipTextSelected: { color: '#fff' },
  chipSub: { color: '#6b7280', fontSize: 11, marginTop: 1 },
})
