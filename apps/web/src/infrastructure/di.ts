import type { PGlite } from '@electric-sql/pglite'
import { PgliteTrailRepository, PgliteTrailDayRepository, PgliteActivityRepository, PgliteTrackpointRepository } from '@traildiary/db'

export function createRepositories(db: PGlite) {
  return {
    trails: new PgliteTrailRepository(db),
    trailDays: new PgliteTrailDayRepository(db),
    activities: new PgliteActivityRepository(db),
    trackpoints: new PgliteTrackpointRepository(db),
  }
}
