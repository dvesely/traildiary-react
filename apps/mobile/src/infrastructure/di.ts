import type { SQLiteDatabase } from 'expo-sqlite'
import type { Repositories } from '@traildiary/ui'
import { SqliteTrailRepository } from './sqlite-trail-repository'
import { SqliteTrailDayRepository, SqliteActivityRepository } from './sqlite-activity-repository'
import { SqliteTrackpointRepository } from './sqlite-trackpoint-repository'

export function createMobileRepositories(db: SQLiteDatabase): Repositories {
  return {
    trails: new SqliteTrailRepository(db),
    trailDays: new SqliteTrailDayRepository(db),
    activities: new SqliteActivityRepository(db),
    trackpoints: new SqliteTrackpointRepository(db),
  }
}
