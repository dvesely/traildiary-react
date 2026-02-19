import type { PGlite } from '@electric-sql/pglite'
import type { TrackpointRepository, TrackPoint } from '@traildiary/core'

export class PgliteTrackpointRepository implements TrackpointRepository {
  constructor(private db: PGlite) {}

  async insertTrackpoints(activityId: string, trailDayId: string, points: TrackPoint[]): Promise<void> {
    // Find the max point_index in this trail day
    const result = await this.db.query<{ max_index: number | null }>(
      `SELECT MAX(t.point_index) as max_index FROM trackpoints t
       JOIN activities a ON t.activity_id = a.id
       WHERE a.trail_day_id = $1`,
      [trailDayId]
    )
    const maxIndex = result.rows[0]?.max_index ?? -1

    const batchSize = 500
    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize)
      const values: unknown[] = []
      const placeholders: string[] = []

      batch.forEach((p, idx) => {
        const offset = idx * 6
        const globalIndex = maxIndex + i + idx + 1
        placeholders.push(
          `($1, $${offset + 2}, $${offset + 3}, $${offset + 4}, ${p.timestamp ? `to_timestamp($${offset + 5}::double precision / 1000)` : 'NULL'}, $${offset + 6}, $${offset + 7})`
        )
        values.push(p.lat, p.lon, p.elevation, p.timestamp || null, globalIndex, p.distance ?? 0) // FIXME: should not be zero
      })

      await this.db.query(
        `INSERT INTO trackpoints (activity_id, lat, lon, elevation, timestamp, point_index, distance_from_start_m) VALUES ${placeholders.join(', ')}`,
        [activityId, ...values]
      )
    }
  }

  async recalculatePointIndices(trailDayId: string, afterActivityId: string): Promise<void> {
    // Get all activities in this trail day ordered by sort_order
    const activities = await this.db.query<{ id: string; sort_order: number }>(
      `SELECT id, sort_order FROM activities WHERE trail_day_id = $1 ORDER BY sort_order`,
      [trailDayId]
    )

    const startActivityIndex = activities.rows.findIndex((a) => a.id === afterActivityId)
    if (startActivityIndex === -1) return

    let globalIndex = 0
    // Calculate indices up to the activity we're starting from
    for (let i = 0; i < startActivityIndex; i++) {
      const countResult = await this.db.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM trackpoints WHERE activity_id = $1`,
        [activities.rows[i].id]
      )
      globalIndex += countResult.rows[0]?.count ?? 0
    }

    // Recalculate from the activity after the one we're starting from
    for (let i = startActivityIndex + 1; i < activities.rows.length; i++) {
      const activityId = activities.rows[i].id
      const countResult = await this.db.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM trackpoints WHERE activity_id = $1`,
        [activityId]
      )
      const pointCount = countResult.rows[0]?.count ?? 0

      // Update all point_index values for this activity
      await this.db.query(
        `UPDATE trackpoints SET point_index = point_index - (SELECT MIN(point_index) FROM trackpoints WHERE activity_id = $1) + $2
         WHERE activity_id = $1`,
        [activityId, globalIndex]
      )
      globalIndex += pointCount
    }
  }

  async getTrackpoints(activityId: string): Promise<TrackPoint[]> {
    const result = await this.db.query<{
      lat: number; lon: number; elevation: number; timestamp: string | null; point_index: number; distance_from_start_m: number
    }>(
      'SELECT lat, lon, elevation, timestamp, point_index, distance_from_start_m FROM trackpoints WHERE activity_id = $1 ORDER BY point_index',
      [activityId]
    )
    return result.rows.map((r) => ({
      lat: r.lat,
      lon: r.lon,
      elevation: r.elevation,
      timestamp: r.timestamp ? new Date(r.timestamp).getTime() : 0,
      index: r.point_index,
      distance: r.distance_from_start_m,
    }))
  }

  async getTrackpointsSampled(activityId: string, sampleRate: number): Promise<TrackPoint[]> {
    const result = await this.db.query<{
      lat: number; lon: number; elevation: number; timestamp: string | null; point_index: number; distance_from_start_m: number
    }>(
      'SELECT lat, lon, elevation, timestamp, point_index, distance_from_start_m FROM trackpoints WHERE activity_id = $1 AND point_index % $2 = 0 ORDER BY point_index',
      [activityId, sampleRate]
    )
    return result.rows.map((r) => ({
      lat: r.lat,
      lon: r.lon,
      elevation: r.elevation,
      timestamp: r.timestamp ? new Date(r.timestamp).getTime() : 0,
      index: r.point_index,
      distance: r.distance_from_start_m,
    }))
  }
}
