import type {
  ActivityRepository,
  TrailDayRepository,
  TrailDayDto,
  ActivityDto,
  SourceFormat,
  TrackStats,
} from '@traildiary/core'
import type { SqliteAdapter } from '../adapter.js'
import { uuidv7 } from './uuidv7.js'

export class SqliteTrailDayRepository implements TrailDayRepository {
  constructor(private db: SqliteAdapter) {}

  async createTrailDay(trailId: string, name: string, dayNumber: number): Promise<string> {
    const id = uuidv7()
    await this.db.run(
      'INSERT INTO trail_days (id, trail_id, name, day_number) VALUES (?, ?, ?, ?)',
      [id, trailId, name, dayNumber],
    )
    return id
  }

  async getTrailDays(trailId: string): Promise<TrailDayDto[]> {
    const rows = await this.db.all<{ id: string; name: string; day_number: number }>(
      'SELECT id, name, day_number FROM trail_days WHERE trail_id = ? ORDER BY day_number',
      [trailId],
    )
    return rows.map((r) => ({ id: r.id, name: r.name, dayNumber: r.day_number }))
  }

  async deleteTrailDay(id: string): Promise<void> {
    await this.db.run('DELETE FROM trail_days WHERE id = ?', [id])
  }
}

export class SqliteActivityRepository implements ActivityRepository {
  constructor(private db: SqliteAdapter) {}

  async createActivity(
    trailDayId: string,
    name: string,
    sourceFormat: SourceFormat,
    stats: TrackStats,
    sortOrder: number,
  ): Promise<string> {
    const id = uuidv7()
    await this.db.run(
      `INSERT INTO activities
         (id, trail_day_id, name, source_format,
          distance_km, elevation_gain_m, elevation_loss_m,
          duration_ms, moving_time_ms, start_time, end_time, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, trailDayId, name, sourceFormat,
        stats.distance, stats.elevationGain, stats.elevationLoss,
        stats.duration, stats.movingTime, stats.startTime, stats.endTime,
        sortOrder,
      ],
    )
    return id
  }

  async getActivities(trailDayId: string): Promise<ActivityDto[]> {
    const rows = await this.db.all<{
      id: string
      name: string
      source_format: string
      distance_km: number
      elevation_gain_m: number
      elevation_loss_m: number
      duration_ms: number
      moving_time_ms: number
      start_time: number
      end_time: number
      sort_order: number
    }>(
      `SELECT id, name, source_format, distance_km, elevation_gain_m, elevation_loss_m,
              duration_ms, moving_time_ms, start_time, end_time, sort_order
       FROM activities WHERE trail_day_id = ? ORDER BY sort_order`,
      [trailDayId],
    )
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      sourceFormat: r.source_format as SourceFormat,
      sortOrder: r.sort_order,
      stats: {
        distance: r.distance_km,
        elevationGain: r.elevation_gain_m,
        elevationLoss: r.elevation_loss_m,
        duration: r.duration_ms,
        movingTime: r.moving_time_ms,
        avgSpeed: r.moving_time_ms > 0
          ? (r.distance_km / r.moving_time_ms) * 3_600_000
          : 0,
        startTime: r.start_time,
        endTime: r.end_time,
      },
    }))
  }

  async deleteActivity(id: string): Promise<void> {
    await this.db.run('DELETE FROM activities WHERE id = ?', [id])
  }
}
