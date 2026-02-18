import type { PGlite } from '@electric-sql/pglite'
import type { TrailRepository, TrailDto, TrailSummaryDto } from '@traildiary/core'
import { uuidv7 } from './uuidv7.js'

export class PgliteTrailRepository implements TrailRepository {
  constructor(private db: PGlite) {}

  async createTrail(name: string): Promise<string> {
    const id = uuidv7()
    await this.db.query(
      'INSERT INTO trails (id, name) VALUES ($1, $2)',
      [id, name]
    )
    return id
  }

  async getTrail(id: string): Promise<TrailDto | null> {
    const result = await this.db.query<TrailDto>(
      'SELECT id, name FROM trails WHERE id = $1',
      [id]
    )
    return result.rows[0] ?? null
  }

  async listTrails(): Promise<TrailDto[]> {
    const result = await this.db.query<TrailDto>(
      'SELECT id, name FROM trails ORDER BY created_at DESC'
    )
    return result.rows
  }

  async deleteTrail(id: string): Promise<void> {
    await this.db.query('DELETE FROM trails WHERE id = $1', [id])
  }

  async listTrailSummaries(): Promise<TrailSummaryDto[]> {
    const result = await this.db.query<{
      id: string
      name: string
      total_distance: number | null
      start_at: string | null
      end_at: string | null
    }>(
      `SELECT
         t.id,
         t.name,
         COALESCE(SUM(a.distance_km), 0) AS total_distance,
         MIN(EXTRACT(EPOCH FROM a.start_time) * 1000) AS start_at,
         MAX(EXTRACT(EPOCH FROM a.end_time) * 1000)   AS end_at
       FROM trails t
       LEFT JOIN trail_days td ON td.trail_id = t.id
       LEFT JOIN activities  a  ON a.trail_day_id = td.id
       GROUP BY t.id, t.name
       ORDER BY t.created_at DESC`
    )
    return result.rows.map((r) => ({
      id: r.id,
      name: r.name,
      totalDistance: r.total_distance ?? 0,
      startAt: r.start_at != null ? Math.round(Number(r.start_at)) : null,
      endAt: r.end_at != null ? Math.round(Number(r.end_at)) : null,
    }))
  }
}
