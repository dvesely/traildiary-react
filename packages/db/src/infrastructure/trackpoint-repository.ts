import type { PGlite } from '@electric-sql/pglite'
import type { TrackpointRepository, TrackPoint } from '@traildiary/core'

export class PgliteTrackpointRepository implements TrackpointRepository {
  constructor(private db: PGlite) {}

  async insertTrackpoints(activityId: string, points: TrackPoint[]): Promise<void> {
    const batchSize = 500
    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize)
      const values: unknown[] = []
      const placeholders: string[] = []

      batch.forEach((p, idx) => {
        const offset = idx * 5
        placeholders.push(
          `($1, $${offset + 2}, $${offset + 3}, $${offset + 4}, ${p.timestamp ? `to_timestamp($${offset + 5}::double precision / 1000)` : 'NULL'}, $${offset + 6})`
        )
        values.push(p.lat, p.lon, p.elevation, p.timestamp || null, i + idx)
      })

      await this.db.query(
        `INSERT INTO trackpoints (activity_id, lat, lon, elevation, timestamp, point_index) VALUES ${placeholders.join(', ')}`,
        [activityId, ...values]
      )
    }
  }

  async getTrackpoints(activityId: string): Promise<TrackPoint[]> {
    const result = await this.db.query<{
      lat: number; lon: number; elevation: number; timestamp: string | null
    }>(
      'SELECT lat, lon, elevation, timestamp FROM trackpoints WHERE activity_id = $1 ORDER BY point_index',
      [activityId]
    )
    return result.rows.map((r) => ({
      lat: r.lat,
      lon: r.lon,
      elevation: r.elevation,
      timestamp: r.timestamp ? new Date(r.timestamp).getTime() : 0,
    }))
  }

  async getTrackpointsSampled(activityId: string, sampleRate: number): Promise<TrackPoint[]> {
    const result = await this.db.query<{
      lat: number; lon: number; elevation: number; timestamp: string | null
    }>(
      'SELECT lat, lon, elevation, timestamp FROM trackpoints WHERE activity_id = $1 AND point_index % $2 = 0 ORDER BY point_index',
      [activityId, sampleRate]
    )
    return result.rows.map((r) => ({
      lat: r.lat,
      lon: r.lon,
      elevation: r.elevation,
      timestamp: r.timestamp ? new Date(r.timestamp).getTime() : 0,
    }))
  }
}
