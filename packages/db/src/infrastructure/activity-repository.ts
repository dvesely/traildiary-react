import type { PGlite } from '@electric-sql/pglite'
import type { ActivityRepository, TrailDayRepository, TrailDayDto, ActivityDto, SourceFormat, TrackStats } from '@traildiary/core'
import { uuidv7 } from './uuidv7.js'

export class PgliteTrailDayRepository implements TrailDayRepository {
  constructor(private db: PGlite) {}

  async createTrailDay(trailId: string, name: string, dayNumber: number): Promise<string> {
    const id = uuidv7()
    await this.db.query(
      'INSERT INTO trail_days (id, trail_id, name, day_number) VALUES ($1, $2, $3, $4)',
      [id, trailId, name, dayNumber]
    )
    return id
  }

  async deleteTrailDay(id: string): Promise<void> {
    await this.db.query('DELETE FROM trail_days WHERE id = $1', [id])
  }

  async getTrailDays(trailId: string): Promise<TrailDayDto[]> {
    const result = await this.db.query<{ id: string; name: string; day_number: number }>(
      'SELECT id, name, day_number FROM trail_days WHERE trail_id = $1 ORDER BY day_number',
      [trailId]
    )
    return result.rows.map((r) => ({ id: r.id, name: r.name, dayNumber: r.day_number }))
  }
}

export class PgliteActivityRepository implements ActivityRepository {
  constructor(private db: PGlite) {}

  async createActivity(
    trailDayId: string,
    name: string,
    sourceFormat: SourceFormat,
    stats: TrackStats,
    sortOrder: number,
  ): Promise<string> {
    const id = uuidv7()
    await this.db.query(
      `INSERT INTO activities (id, trail_day_id, name, source_format, distance_km, elevation_gain_m, elevation_loss_m, duration_ms, moving_time_ms, start_time, end_time, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, to_timestamp($10::double precision / 1000), to_timestamp($11::double precision / 1000), $12)`,
      [id, trailDayId, name, sourceFormat, stats.distance, stats.elevationGain, stats.elevationLoss, stats.duration, stats.movingTime, stats.startTime, stats.endTime, sortOrder]
    )
    return id
  }

  async getActivities(trailDayId: string): Promise<ActivityDto[]> {
    const result = await this.db.query<{
      id: string; name: string; source_format: string
      distance_km: number; elevation_gain_m: number; elevation_loss_m: number
      duration_ms: string; moving_time_ms: string; start_time: string; end_time: string
      sort_order: number
    }>(
      'SELECT * FROM activities WHERE trail_day_id = $1 ORDER BY sort_order',
      [trailDayId]
    )
    return result.rows.map((r) => ({
      id: r.id,
      name: r.name,
      sourceFormat: r.source_format as SourceFormat,
      stats: {
        distance: r.distance_km,
        elevationGain: r.elevation_gain_m,
        elevationLoss: r.elevation_loss_m,
        duration: Number(r.duration_ms),
        movingTime: Number(r.moving_time_ms),
        avgSpeed: Number(r.moving_time_ms) > 0 ? (r.distance_km / Number(r.moving_time_ms)) * 3_600_000 : 0,
        startTime: new Date(r.start_time).getTime(),
        endTime: new Date(r.end_time).getTime(),
      },
      sortOrder: r.sort_order,
    }))
  }

  async deleteActivity(id: string): Promise<void> {
    // Get the trail_day_id before deletion to recalculate indices
    const result = await this.db.query<{ trail_day_id: string }>(
      'SELECT trail_day_id FROM activities WHERE id = $1',
      [id]
    )
    const trailDayId = result.rows[0]?.trail_day_id

    // Delete the activity (trackpoints cascade delete)
    await this.db.query('DELETE FROM activities WHERE id = $1', [id])

    // Note: recalculatePointIndices should be called by the caller if needed
    // to avoid redundant recalculation when deleting multiple activities
  }}