// apps/web/src/infrastructure/di.ts

import {
  SqliteActivityRepository,
  type SqliteAdapter,
  SqliteTrackpointRepository,
  SqliteTrailDayRepository,
  SqliteTrailRepository,
} from '@traildiary/db'
import type { Repositories } from '@traildiary/ui'

export function createRepositories(adapter: SqliteAdapter): Repositories {
  return {
    trails: new SqliteTrailRepository(adapter),
    trailDays: new SqliteTrailDayRepository(adapter),
    activities: new SqliteActivityRepository(adapter),
    trackpoints: new SqliteTrackpointRepository(adapter),
  }
}
