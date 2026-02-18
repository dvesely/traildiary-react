import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PgliteTrailRepository } from '../../infrastructure/trail-repository.js'
import { PgliteTrailDayRepository, PgliteActivityRepository } from '../../infrastructure/activity-repository.js'

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

describe('listTrailSummaries', () => {
  let db: PGlite

  beforeAll(async () => {
    db = new PGlite()
    await db.exec(MIGRATION_SQL)
  })

  afterAll(async () => {
    await db.close()
  })

  it('returns summaries with aggregated distance and startAt/endAt', async () => {
    const trailRepo = new PgliteTrailRepository(db)
    const dayRepo = new PgliteTrailDayRepository(db)
    const actRepo = new PgliteActivityRepository(db)

    const trailId = await trailRepo.createTrail('Alps 2025')
    const dayId = await dayRepo.createTrailDay(trailId, 'Day 1', 1)
    await actRepo.createActivity(dayId, 'Morning hike', 'gpx', {
      distance: 12.5,
      elevationGain: 800,
      elevationLoss: 200,
      duration: 14400000,
      movingTime: 13000000,
      avgSpeed: 3.5,
      startTime: 1700000000000,
      endTime: 1700014400000,
    }, 1)

    const summaries = await trailRepo.listTrailSummaries()
    const summary = summaries.find((s) => s.id === trailId)

    expect(summary).toBeDefined()
    expect(summary!.name).toBe('Alps 2025')
    expect(summary!.totalDistance).toBeCloseTo(12.5, 1)
    expect(summary!.startAt).toBe(1700000000000)
    expect(summary!.endAt).toBe(1700014400000)
  })

  it('returns null startAt/endAt for trail with no activities', async () => {
    const trailRepo = new PgliteTrailRepository(db)
    const trailId = await trailRepo.createTrail('Empty Trail')

    const summaries = await trailRepo.listTrailSummaries()
    const summary = summaries.find((s) => s.id === trailId)

    expect(summary).toBeDefined()
    expect(summary!.totalDistance).toBe(0)
    expect(summary!.startAt).toBeNull()
    expect(summary!.endAt).toBeNull()
  })
})
