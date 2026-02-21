import type { TrailRepository, TrailDto, TrailSummaryDto } from '@traildiary/core'
import type { SqliteAdapter } from '../adapter.js'
import { uuidv7 } from './uuidv7.js'

export class SqliteTrailRepository implements TrailRepository {
  constructor(private db: SqliteAdapter) {}

  async createTrail(name: string): Promise<string> {
    const id = uuidv7()
    await this.db.run(
      'INSERT INTO trails (id, name, created_at) VALUES (?, ?, ?)',
      [id, name, Date.now()],
    )
    return id
  }

  async getTrail(id: string): Promise<TrailDto | null> {
    const row = await this.db.get<TrailDto>(
      'SELECT id, name FROM trails WHERE id = ?',
      [id],
    )
    return row ?? null
  }

  async listTrails(): Promise<TrailDto[]> {
    return this.db.all<TrailDto>(
      'SELECT id, name FROM trails ORDER BY created_at DESC',
    )
  }

  async listTrailSummaries(): Promise<TrailSummaryDto[]> {
    const rows = await this.db.all<{
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
       ORDER BY t.created_at DESC`,
    )
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      totalDistance: r.totalDistance ?? 0,
      startAt: r.startAt ?? null,
      endAt: r.endAt ?? null,
    }))
  }

  async deleteTrail(id: string): Promise<void> {
    await this.db.run('DELETE FROM trails WHERE id = ?', [id])
  }
}
