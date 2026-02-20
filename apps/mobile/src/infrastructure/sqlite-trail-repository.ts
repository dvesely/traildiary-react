import type { SQLiteDatabase } from 'expo-sqlite'
import type { TrailRepository, TrailDto, TrailSummaryDto } from '@traildiary/core'
import { uuidv7 } from './uuidv7'

export class SqliteTrailRepository implements TrailRepository {
  constructor(private db: SQLiteDatabase) {}

  async createTrail(name: string): Promise<string> {
    const id = uuidv7()
    const now = Date.now()
    await this.db.runAsync(
      'INSERT INTO trails (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
      [id, name, now, now]
    )
    return id
  }

  async getTrail(id: string): Promise<TrailDto | null> {
    const row = await this.db.getFirstAsync<{ id: string; name: string }>(
      'SELECT id, name FROM trails WHERE id = ?',
      [id]
    )
    return row ?? null
  }

  async listTrails(): Promise<TrailDto[]> {
    return this.db.getAllAsync<TrailDto>(
      'SELECT id, name FROM trails ORDER BY created_at DESC'
    )
  }

  async listTrailSummaries(): Promise<TrailSummaryDto[]> {
    const rows = await this.db.getAllAsync<{
      id: string
      name: string
      totalDistance: number
      startAt: number | null
      endAt: number | null
    }>(
      `SELECT
         t.id,
         t.name,
         COALESCE(SUM(a.distance_km), 0) AS totalDistance,
         MIN(a.start_time)               AS startAt,
         MAX(a.end_time)                 AS endAt
       FROM trails t
       LEFT JOIN trail_days td ON td.trail_id = t.id
       LEFT JOIN activities  a  ON a.trail_day_id = td.id
       GROUP BY t.id, t.name
       ORDER BY t.created_at DESC`
    )
    return rows
  }

  async deleteTrail(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM trails WHERE id = ?', [id])
  }
}
