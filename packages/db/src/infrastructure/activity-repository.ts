import type { PGlite } from '@electric-sql/pglite'
import type { ActivityRepository, TrailDayRepository, TrailDayDto, ActivityDto, SourceFormat, TrackStats } from '@traildiary/core'

export class PgliteTrailDayRepository implements TrailDayRepository {
  constructor(private db: PGlite) {}

  async createTrailDay(trailId: string, name: string, dayNumber: number): Promise<string> {
    const result = await this.db.query<{ id: string }>(
      'INSERT INTO trail_days (trail_id, name, day_number) VALUES ($1, $2, $3) RETURNING id',
      [trailId, name, dayNumber]
    )
    return result.rows[0].id
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
    const result = await this.db.query<{ id: string }>(
      `INSERT INTO activities (trail_day_id, name, source_format, distance_km, elevation_gain_m, elevation_loss_m, duration_ms, moving_time_ms, start_time, end_time, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, to_timestamp($9::double precision / 1000), to_timestamp($10::double precision / 1000), $11)
       RETURNING id`,
      [trailDayId, name, sourceFormat, stats.distance, stats.elevationGain, stats.elevationLoss, stats.duration, stats.movingTime, stats.startTime, stats.endTime, sortOrder]
    )
    return result.rows[0].id
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
}
