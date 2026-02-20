import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import * as SQLite from 'expo-sqlite'
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { RepositoryProvider } from '@traildiary/ui'
import { createMobileRepositories } from './di'

const MIGRATION_SQL = `
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS trails (
  id         TEXT    PRIMARY KEY,
  name       TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS trail_days (
  id        TEXT    PRIMARY KEY,
  trail_id  TEXT    NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
  name      TEXT    NOT NULL,
  day_number INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS activities (
  id               TEXT    PRIMARY KEY,
  trail_day_id     TEXT    NOT NULL REFERENCES trail_days(id) ON DELETE CASCADE,
  name             TEXT    NOT NULL,
  source_format    TEXT    NOT NULL,
  distance_km      REAL,
  elevation_gain_m REAL,
  elevation_loss_m REAL,
  duration_ms      INTEGER,
  moving_time_ms   INTEGER,
  avg_speed_kmh    REAL,
  start_time       INTEGER,
  end_time         INTEGER,
  sort_order       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS trackpoints (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id           TEXT    NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  trail_day_id          TEXT    NOT NULL,
  lat                   REAL    NOT NULL,
  lon                   REAL    NOT NULL,
  elevation             REAL,
  timestamp             INTEGER,
  point_index           INTEGER NOT NULL,
  distance_from_start_m REAL
);

CREATE INDEX IF NOT EXISTS idx_tp_activity  ON trackpoints(activity_id);
CREATE INDEX IF NOT EXISTS idx_tp_trail_day ON trackpoints(trail_day_id);
`

export function SqliteProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    SQLite.openDatabaseAsync('traildiary.db')
      .then(async (database) => {
        await database.execAsync(MIGRATION_SQL)
        setDb(database)
      })
      .catch((e: unknown) => setError(String(e)))
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
