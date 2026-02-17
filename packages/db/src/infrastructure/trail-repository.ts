import type { PGlite } from '@electric-sql/pglite'
import type { TrailRepository, TrailDto } from '@traildiary/core'
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
}
