import type { SQLiteDatabase } from 'expo-sqlite'
import type { TrackpointRepository, TrackPoint } from '@traildiary/core'

export class SqliteTrackpointRepository implements TrackpointRepository {
  constructor(private db: SQLiteDatabase) {}

  async insertTrackpoints(activityId: string, trailDayId: string, points: TrackPoint[]): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      for (let i = 0; i < points.length; i += 500) {
        const chunk = points.slice(i, i + 500)
        const placeholders = chunk.map(() => '(?,?,?,?,?,?,?,?)').join(',')
        const values = chunk.flatMap((p) => [
          activityId,
          trailDayId,
          p.lat,
          p.lon,
          p.elevation ?? null,
          p.timestamp ?? null,
          p.index,
          p.distance ?? null,
        ])
        await this.db.runAsync(
          `INSERT INTO trackpoints
             (activity_id, trail_day_id, lat, lon, elevation, timestamp, point_index, distance_from_start_m)
           VALUES ${placeholders}`,
          values
        )
      }
    })
  }

  async getTrackpoints(activityId: string): Promise<TrackPoint[]> {
    const rows = await this.db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM trackpoints WHERE activity_id = ? ORDER BY point_index',
      [activityId]
    )
    return this.mapRows(rows)
  }

  async getTrackpointsSampled(activityId: string, sampleRate: number): Promise<TrackPoint[]> {
    const rows = await this.db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM trackpoints WHERE activity_id = ? AND point_index % ? = 0 ORDER BY point_index',
      [activityId, sampleRate]
    )
    return this.mapRows(rows)
  }

  async recalculatePointIndices(_trailDayId: string, _afterActivityId: string): Promise<void> {
    // no-op — indices are set at insert time
  }

  private mapRows(rows: Record<string, unknown>[]): TrackPoint[] {
    return rows.map((r) => ({
      lat: r.lat as number,
      lon: r.lon as number,
      elevation: (r.elevation as number) ?? 0,
      timestamp: (r.timestamp as number) ?? 0,
      index: r.point_index as number,
      distance: (r.distance_from_start_m as number) ?? 0,
    }))
  }
}
