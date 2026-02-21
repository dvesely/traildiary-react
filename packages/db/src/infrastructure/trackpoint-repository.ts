import type { TrackpointRepository, TrackPoint } from '@traildiary/core'
import type { SqliteAdapter } from '../adapter.js'

const BATCH_SIZE = 100

export class SqliteTrackpointRepository implements TrackpointRepository {
  constructor(private db: SqliteAdapter) {}

  async insertTrackpoints(
    activityId: string,
    trailDayId: string,
    points: TrackPoint[],
  ): Promise<void> {
    await this.db.transaction(async () => {
      for (let i = 0; i < points.length; i += BATCH_SIZE) {
        const chunk = points.slice(i, i + BATCH_SIZE)
        const placeholders = chunk.map(() => '(?,?,?,?,?,?,?,?)').join(',')
        const values = chunk.flatMap((p) => [
          activityId,
          trailDayId,
          p.lat,
          p.lon,
          p.elevation ?? null,
          p.timestamp ?? null,
          p.index,
          p.distance ?? 0,
        ])
        await this.db.run(
          `INSERT INTO trackpoints
             (activity_id, trail_day_id, lat, lon, elevation, timestamp, point_index, distance_from_start_m)
           VALUES ${placeholders}`,
          values,
        )
      }
    })
  }

  async getTrackpoints(activityId: string): Promise<TrackPoint[]> {
    const rows = await this.db.all<{
      lat: number; lon: number; elevation: number | null
      timestamp: number | null; point_index: number; distance_from_start_m: number
    }>(
      `SELECT lat, lon, elevation, timestamp, point_index, distance_from_start_m
       FROM trackpoints WHERE activity_id = ? ORDER BY point_index`,
      [activityId],
    )
    return rows.map(mapRow)
  }

  async getTrackpointsSampled(activityId: string, sampleRate: number): Promise<TrackPoint[]> {
    const rows = await this.db.all<{
      lat: number; lon: number; elevation: number | null
      timestamp: number | null; point_index: number; distance_from_start_m: number
    }>(
      `SELECT lat, lon, elevation, timestamp, point_index, distance_from_start_m
       FROM trackpoints WHERE activity_id = ? AND point_index % ? = 0 ORDER BY point_index`,
      [activityId, sampleRate],
    )
    return rows.map(mapRow)
  }

  async recalculatePointIndices(_trailDayId: string, _afterActivityId: string): Promise<void> {
    // no-op — indices are local to each activity, set at insert time
  }
}

function mapRow(r: {
  lat: number; lon: number; elevation: number | null
  timestamp: number | null; point_index: number; distance_from_start_m: number
}): TrackPoint {
  return {
    lat: r.lat,
    lon: r.lon,
    elevation: r.elevation ?? 0,
    timestamp: r.timestamp ?? 0,
    index: r.point_index,
    distance: r.distance_from_start_m,
  }
}
