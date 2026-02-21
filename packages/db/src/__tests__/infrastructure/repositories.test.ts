import { describe, it, expect, beforeEach } from 'vitest'
import { SCHEMA_SQL } from '../../schema.js'
import { SqliteTrailRepository } from '../../infrastructure/trail-repository.js'
import { SqliteTrailDayRepository, SqliteActivityRepository } from '../../infrastructure/activity-repository.js'
import { SqliteTrackpointRepository } from '../../infrastructure/trackpoint-repository.js'
import { createTestAdapter } from '../better-sqlite-adapter.js'
import type { SqliteAdapter } from '../../adapter.js'

function makeDb(): SqliteAdapter {
  const db = createTestAdapter()
  db.exec(SCHEMA_SQL)
  return db
}

describe('SqliteTrailRepository', () => {
  let db: SqliteAdapter

  beforeEach(() => { db = makeDb() })

  it('creates and retrieves a trail', async () => {
    const repo = new SqliteTrailRepository(db)
    const id = await repo.createTrail('TMB 2025')
    const trail = await repo.getTrail(id)
    expect(trail).not.toBeNull()
    expect(trail!.name).toBe('TMB 2025')
  })

  it('lists trails ordered by created_at desc', async () => {
    const repo = new SqliteTrailRepository(db)
    await repo.createTrail('First')
    await new Promise((r) => setTimeout(r, 5))
    await repo.createTrail('Second')
    const trails = await repo.listTrails()
    expect(trails.length).toBe(2)
    expect(trails[0].name).toBe('Second')
  })

  it('deletes a trail (cascades to days, activities, trackpoints)', async () => {
    const repo = new SqliteTrailRepository(db)
    const id = await repo.createTrail('To delete')
    await repo.deleteTrail(id)
    const trail = await repo.getTrail(id)
    expect(trail).toBeNull()
  })
})

describe('SqliteTrailDayRepository', () => {
  let db: SqliteAdapter

  beforeEach(() => { db = makeDb() })

  it('creates trail days and returns them ordered', async () => {
    const trailRepo = new SqliteTrailRepository(db)
    const dayRepo = new SqliteTrailDayRepository(db)
    const trailId = await trailRepo.createTrail('PCT 2025')
    await dayRepo.createTrailDay(trailId, 'Day 2', 2)
    await dayRepo.createTrailDay(trailId, 'Day 1', 1)
    const days = await dayRepo.getTrailDays(trailId)
    expect(days.length).toBe(2)
    expect(days[0].dayNumber).toBe(1)
    expect(days[1].dayNumber).toBe(2)
  })
})

describe('listTrailSummaries', () => {
  let db: SqliteAdapter

  beforeEach(() => { db = makeDb() })

  it('returns aggregated distance and startAt/endAt', async () => {
    const trailRepo = new SqliteTrailRepository(db)
    const dayRepo = new SqliteTrailDayRepository(db)
    const actRepo = new SqliteActivityRepository(db)
    const trailId = await trailRepo.createTrail('Alps 2025')
    const dayId = await dayRepo.createTrailDay(trailId, 'Day 1', 1)
    await actRepo.createActivity(dayId, 'Morning hike', 'gpx', {
      distance: 12.5, elevationGain: 800, elevationLoss: 200,
      duration: 14_400_000, movingTime: 13_000_000, avgSpeed: 3.5,
      startTime: 1_700_000_000_000, endTime: 1_700_014_400_000,
    }, 1)
    const summaries = await trailRepo.listTrailSummaries()
    const s = summaries.find((x) => x.id === trailId)!
    expect(s.name).toBe('Alps 2025')
    expect(s.totalDistance).toBeCloseTo(12.5, 1)
    expect(s.startAt).toBe(1_700_000_000_000)
    expect(s.endAt).toBe(1_700_014_400_000)
  })

  it('returns null startAt/endAt for trail with no activities', async () => {
    const trailRepo = new SqliteTrailRepository(db)
    const trailId = await trailRepo.createTrail('Empty Trail')
    const summaries = await trailRepo.listTrailSummaries()
    const s = summaries.find((x) => x.id === trailId)!
    expect(s.totalDistance).toBe(0)
    expect(s.startAt).toBeNull()
    expect(s.endAt).toBeNull()
  })
})

describe('SqliteTrackpointRepository', () => {
  let db: SqliteAdapter

  beforeEach(() => { db = makeDb() })

  it('inserts and retrieves trackpoints', async () => {
    const trailRepo = new SqliteTrailRepository(db)
    const dayRepo = new SqliteTrailDayRepository(db)
    const actRepo = new SqliteActivityRepository(db)
    const tpRepo = new SqliteTrackpointRepository(db)

    const trailId = await trailRepo.createTrail('T')
    const dayId = await dayRepo.createTrailDay(trailId, 'D1', 1)
    const actId = await actRepo.createActivity(dayId, 'A', 'gpx', {
      distance: 1, elevationGain: 0, elevationLoss: 0,
      duration: 0, movingTime: 0, avgSpeed: 0, startTime: 0, endTime: 0,
    }, 1)

    const points = Array.from({ length: 5 }, (_, i) => ({
      lat: 47 + i * 0.001, lon: 8 + i * 0.001, elevation: 800 + i,
      timestamp: 1_700_000_000_000 + i * 60_000, index: i, distance: i * 100,
    }))

    await tpRepo.insertTrackpoints(actId, dayId, points)
    const retrieved = await tpRepo.getTrackpoints(actId)
    expect(retrieved.length).toBe(5)
    expect(retrieved[0].lat).toBeCloseTo(47, 3)
    expect(retrieved[2].index).toBe(2)
  })

  it('samples trackpoints by sampleRate', async () => {
    const trailRepo = new SqliteTrailRepository(db)
    const dayRepo = new SqliteTrailDayRepository(db)
    const actRepo = new SqliteActivityRepository(db)
    const tpRepo = new SqliteTrackpointRepository(db)

    const trailId = await trailRepo.createTrail('T')
    const dayId = await dayRepo.createTrailDay(trailId, 'D1', 1)
    const actId = await actRepo.createActivity(dayId, 'A', 'gpx', {
      distance: 1, elevationGain: 0, elevationLoss: 0,
      duration: 0, movingTime: 0, avgSpeed: 0, startTime: 0, endTime: 0,
    }, 1)

    const points = Array.from({ length: 10 }, (_, i) => ({
      lat: 47, lon: 8, elevation: 800, timestamp: 0, index: i, distance: 0,
    }))
    await tpRepo.insertTrackpoints(actId, dayId, points)

    const sampled = await tpRepo.getTrackpointsSampled(actId, 3)
    expect(sampled.length).toBe(4)
    expect(sampled.map((p) => p.index)).toEqual([0, 3, 6, 9])
  })
})
