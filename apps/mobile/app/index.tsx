import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { useTrails } from '@traildiary/ui'

export default function TrailsScreen() {
  const { trails, loading, deleteTrail } = useTrails()

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Loading trails…</Text>
      </View>
    )
  }

  if (trails.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.heading}>No trails yet</Text>
        <Text style={styles.muted}>Import a GPX or FIT file to get started</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.push('/import')}>
          <Text style={styles.btnText}>Import Activity</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={trails}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/trail/${item.id}`)}
            onLongPress={() => deleteTrail(item.id)}
          >
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardMeta}>
              {item.totalDistance?.toFixed(1)} km
            </Text>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
      <TouchableOpacity style={styles.fab} onPress={() => router.push('/import')}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111', padding: 24, gap: 8 },
  heading: { color: '#fff', fontSize: 20, fontWeight: '700' },
  muted: { color: '#9ca3af', fontSize: 14 },
  btn: { marginTop: 8, backgroundColor: '#3b82f6', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  card: { padding: 16, backgroundColor: '#111' },
  cardTitle: { color: '#fff', fontSize: 17, fontWeight: '600' },
  cardMeta: { color: '#9ca3af', marginTop: 3, fontSize: 13 },
  separator: { height: 1, backgroundColor: '#1f2937' },
  fab: {
    position: 'absolute', bottom: 28, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#3b82f6',
    alignItems: 'center', justifyContent: 'center',
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  fabText: { color: '#fff', fontSize: 30, lineHeight: 34 },
})
