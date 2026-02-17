import type { PGlite } from '@electric-sql/pglite'
import type { TrailRepository, TrailDto } from '@traildiary/core'

export class PgliteTrailRepository implements TrailRepository {
  constructor(private db: PGlite) {}

  async createTrail(name: string): Promise<string> {
    const result = await this.db.query<{ id: string }>(
      'INSERT INTO trails (name) VALUES ($1) RETURNING id',
      [name]
    )
    return result.rows[0].id
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
}
