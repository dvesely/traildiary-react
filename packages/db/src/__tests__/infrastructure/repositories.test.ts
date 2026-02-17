import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PgliteTrailRepository } from '../../infrastructure/trail-repository.js'
import { PgliteTrailDayRepository } from '../../infrastructure/activity-repository.js'

const MIGRATION_SQL = readFileSync(
  resolve(__dirname, '../../migrations/001-initial-schema.sql'),
  'utf-8'
)

describe('PGlite repositories', () => {
  let db: PGlite

  beforeAll(async () => {
    db = new PGlite()
    await db.exec(MIGRATION_SQL)
  })

  afterAll(async () => {
    await db.close()
  })

  it('creates and retrieves a trail', async () => {
    const repo = new PgliteTrailRepository(db)
    const id = await repo.createTrail('TMB 2025')
    const trail = await repo.getTrail(id)
    expect(trail).not.toBeNull()
    expect(trail!.name).toBe('TMB 2025')
  })

  it('creates trail days', async () => {
    const trailRepo = new PgliteTrailRepository(db)
    const dayRepo = new PgliteTrailDayRepository(db)

    const trailId = await trailRepo.createTrail('PCT 2025')
    await dayRepo.createTrailDay(trailId, 'Day 1', 1)
    await dayRepo.createTrailDay(trailId, 'Day 2', 2)

    const days = await dayRepo.getTrailDays(trailId)
    expect(days.length).toBe(2)
    expect(days[0].dayNumber).toBe(1)
    expect(days[1].dayNumber).toBe(2)
  })

  it('lists trails', async () => {
    const repo = new PgliteTrailRepository(db)
    const trails = await repo.listTrails()
    expect(trails.length).toBeGreaterThanOrEqual(2)
  })
})
