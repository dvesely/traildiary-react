// apps/mobile/src/infrastructure/sqlite-provider.tsx
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import * as SQLite from 'expo-sqlite'
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { RepositoryProvider } from '@traildiary/ui'
import { SCHEMA_SQL } from '@traildiary/db'
import { createMobileRepositories } from './di'

export function SqliteProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    SQLite.openDatabaseAsync('traildiary.db')
      .then(async (database) => {
        await database.execAsync(SCHEMA_SQL)
        if (!cancelled) setDb(database)
      })
      .catch((e: unknown) => setError(String(e)))
    return () => { cancelled = true }
  }, [])

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Database error: {error}</Text>
      </View>
    )
  }

  if (!db) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#3b82f6" />
      </View>
    )
  }

  return (
    <RepositoryProvider repositories={createMobileRepositories(db)}>
      {children}
    </RepositoryProvider>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' },
  error: { color: '#ef4444', padding: 16 },
})
