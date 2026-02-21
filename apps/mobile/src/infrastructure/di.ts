// apps/mobile/src/infrastructure/di.ts

import {
  SqliteActivityRepository,
  SqliteTrackpointRepository,
  SqliteTrailDayRepository,
  SqliteTrailRepository,
} from '@traildiary/db'
import type { Repositories } from '@traildiary/ui'
import type { SQLiteDatabase } from 'expo-sqlite'
import { ExpoSqliteAdapter } from './expo-sqlite-adapter'

export function createMobileRepositories(db: SQLiteDatabase): Repositories {
  const adapter = new ExpoSqliteAdapter(db)
  return {
    trails: new SqliteTrailRepository(adapter),
    trailDays: new SqliteTrailDayRepository(adapter),
    activities: new SqliteActivityRepository(adapter),
    trackpoints: new SqliteTrackpointRepository(adapter),
  }
}
