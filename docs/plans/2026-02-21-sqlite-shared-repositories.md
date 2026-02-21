# SQLite Shared Repositories Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace platform-specific DB implementations (PGlite on web, siloed expo-sqlite on mobile) with a single shared SQLite repository layer in `packages/db`, adapting to each platform via a thin driver adapter.

**Architecture:** Define a `SqliteAdapter` interface in `packages/db` that abstracts the DB driver (query, get, run, exec, transaction). All SQL logic lives in shared repository classes that take only `SqliteAdapter`. Mobile wraps `expo-sqlite`; web wraps `wa-sqlite` with `IDBBatchAtomicVFS` (IndexedDB persistence, no COOP/COEP headers needed, main-thread compatible). Tests use `better-sqlite3` in Node.

**Tech Stack:** `expo-sqlite` (mobile), `wa-sqlite` + `IDBBatchAtomicVFS` (web browser), `better-sqlite3` (test only), `vitest`, TypeScript.

---

## Background – Current State

| Layer | Mobile | Web |
|---|---|---|
| DB driver | `expo-sqlite` | `@electric-sql/pglite` (PostgreSQL!) |
| Repositories | `apps/mobile/src/infrastructure/sqlite-*.ts` | `packages/db/src/infrastructure/*.ts` |
| SQL syntax | SQLite `?` | PostgreSQL `$1`, `to_timestamp()`, `TIMESTAMPTZ` |
| Schema | embedded in `sqlite-provider.tsx` | `packages/db/src/migrations/001-initial-schema.sql` |

After this plan, both platforms share one set of repository classes and one schema in `packages/db`.

---

## Task 1: Define `SqliteAdapter` interface

**Files:**
- Create: `packages/db/src/adapter.ts`
- Modify: `packages/db/src/index.ts`

**Step 1: Create the adapter interface**

```typescript
// packages/db/src/adapter.ts
export interface SqliteAdapter {
  /** Execute a write statement (INSERT, UPDATE, DELETE). */
  run(sql: string, params?: unknown[]): Promise<void>
  /** Return the first matching row, or undefined. */
  get<T>(sql: string, params?: unknown[]): Promise<T | undefined>
  /** Return all matching rows. */
  all<T>(sql: string, params?: unknown[]): Promise<T[]>
  /** Execute raw DDL / PRAGMA (no params). */
  exec(sql: string): Promise<void>
  /** Wrap multiple operations in a transaction; rolls back on throw. */
  transaction(fn: () => Promise<void>): Promise<void>
}
```

**Step 2: Re-export from index**

```typescript
// packages/db/src/index.ts  — append this line (keep old exports for now)
export type { SqliteAdapter } from './adapter.js'
```

**Step 3: Commit**

```bash
git add packages/db/src/adapter.ts packages/db/src/index.ts
git commit -m "feat(db): add SqliteAdapter port interface"
```

---

## Task 2: Write shared SQLite schema as a TypeScript constant

**Files:**
- Create: `packages/db/src/schema.ts`
- Modify: `packages/db/src/index.ts`

The schema must use SQLite syntax (no PostgreSQL types). It is exported as a plain string so both Metro (React Native) and Vite can import it without loaders.

**Step 1: Create schema constant**

```typescript
// packages/db/src/schema.ts
export const SCHEMA_SQL = `
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS trails (
  id         TEXT    PRIMARY KEY NOT NULL,
  name       TEXT    NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS trail_days (
  id         TEXT    PRIMARY KEY NOT NULL,
  trail_id   TEXT    NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  day_number INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS activities (
  id               TEXT    PRIMARY KEY NOT NULL,
  trail_day_id     TEXT    NOT NULL REFERENCES trail_days(id) ON DELETE CASCADE,
  name             TEXT    NOT NULL,
  source_format    TEXT    NOT NULL,
  distance_km      REAL,
  elevation_gain_m REAL,
  elevation_loss_m REAL,
  duration_ms      INTEGER,
  moving_time_ms   INTEGER,
  start_time       INTEGER,
  end_time         INTEGER,
  sort_order       INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS trackpoints (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id           TEXT    NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  trail_day_id          TEXT    NOT NULL,
  lat                   REAL    NOT NULL,
  lon                   REAL    NOT NULL,
  elevation             REAL,
  timestamp             INTEGER,
  point_index           INTEGER NOT NULL,
  distance_from_start_m REAL    NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_tp_activity  ON trackpoints(activity_id);
CREATE INDEX IF NOT EXISTS idx_tp_trail_day ON trackpoints(trail_day_id);
CREATE INDEX IF NOT EXISTS idx_act_trail_day ON activities(trail_day_id);
CREATE INDEX IF NOT EXISTS idx_td_trail      ON trail_days(trail_id);
`.trim()
```

**Step 2: Export from index**

```typescript
// packages/db/src/index.ts  — append
export { SCHEMA_SQL } from './schema.js'
```

**Step 3: Commit**

```bash
git add packages/db/src/schema.ts packages/db/src/index.ts
git commit -m "feat(db): add shared SQLite schema constant"
```

---

## Task 3: Rewrite `TrailRepository` for `SqliteAdapter`

**Files:**
- Modify: `packages/db/src/infrastructure/trail-repository.ts`

The PGlite version uses `$1` params and `EXTRACT(EPOCH FROM ...)` for timestamps. SQLite uses `?` and stores timestamps as plain integers (Unix ms).

**Step 1: Overwrite the file**

```typescript
// packages/db/src/infrastructure/trail-repository.ts
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
```

**Step 2: Commit**

```bash
git add packages/db/src/infrastructure/trail-repository.ts
git commit -m "feat(db): migrate TrailRepository to SqliteAdapter"
```

---

## Task 4: Rewrite `TrailDayRepository` and `ActivityRepository`

**Files:**
- Modify: `packages/db/src/infrastructure/activity-repository.ts`

**Step 1: Overwrite the file**

```typescript
// packages/db/src/infrastructure/activity-repository.ts
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
```

**Step 2: Commit**

```bash
git add packages/db/src/infrastructure/activity-repository.ts
git commit -m "feat(db): migrate TrailDay/ActivityRepository to SqliteAdapter"
```

---

## Task 5: Rewrite `TrackpointRepository`

**Files:**
- Modify: `packages/db/src/infrastructure/trackpoint-repository.ts`

Points are inserted per-activity with local indices (index within the activity). `recalculatePointIndices` is a no-op; global ordering is not needed since all queries filter by `activity_id`. Batch size: 100 rows × 8 cols = 800 params (safely under SQLite's default limit of 999).

**Step 1: Overwrite the file**

```typescript
// packages/db/src/infrastructure/trackpoint-repository.ts
import type { TrackpointRepository, TrackPoint } from '@traildiary/core'
import type { SqliteAdapter } from '../adapter.js'

const BATCH_SIZE = 100

export class SqliteTrackpointRepository implements TrackpointRepository {
  constructor(private db: SqliteAdapter) {}

  async insertTrackpoints(
    activityId: string,
    trailDayId: string,
    points: TrackPoint[],
  ): Promise<void> {
    await this.db.transaction(async () => {
      for (let i = 0; i < points.length; i += BATCH_SIZE) {
        const chunk = points.slice(i, i + BATCH_SIZE)
        const placeholders = chunk.map(() => '(?,?,?,?,?,?,?,?)').join(',')
        const values = chunk.flatMap((p) => [
          activityId,
          trailDayId,
          p.lat,
          p.lon,
          p.elevation ?? null,
          p.timestamp ?? null,
          p.index,
          p.distance ?? 0,
        ])
        await this.db.run(
          `INSERT INTO trackpoints
             (activity_id, trail_day_id, lat, lon, elevation, timestamp, point_index, distance_from_start_m)
           VALUES ${placeholders}`,
          values,
        )
      }
    })
  }

  async getTrackpoints(activityId: string): Promise<TrackPoint[]> {
    const rows = await this.db.all<{
      lat: number; lon: number; elevation: number | null
      timestamp: number | null; point_index: number; distance_from_start_m: number
    }>(
      `SELECT lat, lon, elevation, timestamp, point_index, distance_from_start_m
       FROM trackpoints WHERE activity_id = ? ORDER BY point_index`,
      [activityId],
    )
    return rows.map(mapRow)
  }

  async getTrackpointsSampled(activityId: string, sampleRate: number): Promise<TrackPoint[]> {
    const rows = await this.db.all<{
      lat: number; lon: number; elevation: number | null
      timestamp: number | null; point_index: number; distance_from_start_m: number
    }>(
      `SELECT lat, lon, elevation, timestamp, point_index, distance_from_start_m
       FROM trackpoints WHERE activity_id = ? AND point_index % ? = 0 ORDER BY point_index`,
      [activityId, sampleRate],
    )
    return rows.map(mapRow)
  }

  async recalculatePointIndices(_trailDayId: string, _afterActivityId: string): Promise<void> {
    // no-op — indices are local to each activity, set at insert time
  }
}

function mapRow(r: {
  lat: number; lon: number; elevation: number | null
  timestamp: number | null; point_index: number; distance_from_start_m: number
}): TrackPoint {
  return {
    lat: r.lat,
    lon: r.lon,
    elevation: r.elevation ?? 0,
    timestamp: r.timestamp ?? 0,
    index: r.point_index,
    distance: r.distance_from_start_m,
  }
}
```

**Step 2: Commit**

```bash
git add packages/db/src/infrastructure/trackpoint-repository.ts
git commit -m "feat(db): migrate TrackpointRepository to SqliteAdapter"
```

---

## Task 6: Update `packages/db` exports and `package.json`

**Files:**
- Modify: `packages/db/src/index.ts`
- Modify: `packages/db/package.json`
- Delete: `packages/db/src/infrastructure/pglite-client.ts`

**Step 1: Rewrite `index.ts`**

```typescript
// packages/db/src/index.ts
export type { SqliteAdapter } from './adapter.js'
export { SCHEMA_SQL } from './schema.js'
export { SqliteTrailRepository } from './infrastructure/trail-repository.js'
export { SqliteTrailDayRepository, SqliteActivityRepository } from './infrastructure/activity-repository.js'
export { SqliteTrackpointRepository } from './infrastructure/trackpoint-repository.js'
export { uuidv7 } from './infrastructure/uuidv7.js'
```

**Step 2: Remove PGlite from `package.json`**

```json
{
  "name": "@traildiary/db",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@traildiary/core": "workspace:*"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.12",
    "better-sqlite3": "^11.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

**Step 3: Delete pglite-client.ts**

```bash
rm packages/db/src/infrastructure/pglite-client.ts
```

**Step 4: Install deps**

```bash
pnpm install
```

**Step 5: Commit**

```bash
git add packages/db/src/index.ts packages/db/package.json
git rm packages/db/src/infrastructure/pglite-client.ts
git commit -m "feat(db): finalize packages/db — remove PGlite, export shared SQLite repos"
```

---

## Task 7: Update `packages/db` tests to use `better-sqlite3` adapter

**Files:**
- Modify: `packages/db/src/__tests__/infrastructure/repositories.test.ts`
- Create: `packages/db/src/__tests__/better-sqlite-adapter.ts`

**Step 1: Create test adapter**

```typescript
// packages/db/src/__tests__/better-sqlite-adapter.ts
import Database from 'better-sqlite3'
import type { SqliteAdapter } from '../adapter.js'

export function createTestAdapter(path = ':memory:'): SqliteAdapter {
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  return {
    async run(sql, params = []) {
      db.prepare(sql).run(...params)
    },
    async get<T>(sql: string, params: unknown[] = []) {
      return db.prepare(sql).get(...params) as T | undefined
    },
    async all<T>(sql: string, params: unknown[] = []) {
      return db.prepare(sql).all(...params) as T[]
    },
    async exec(sql) {
      db.exec(sql)
    },
    async transaction(fn) {
      db.exec('BEGIN')
      try {
        await fn()
        db.exec('COMMIT')
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }
    },
  }
}
```

**Step 2: Rewrite `repositories.test.ts`**

```typescript
// packages/db/src/__tests__/infrastructure/repositories.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { SCHEMA_SQL } from '../../schema.js'
import { SqliteTrailRepository } from '../../infrastructure/trail-repository.js'
import { SqliteTrailDayRepository, SqliteActivityRepository } from '../../infrastructure/activity-repository.js'
import { SqliteTrackpointRepository } from '../../infrastructure/trackpoint-repository.js'
import { createTestAdapter } from '../better-sqlite-adapter.js'
import type { SqliteAdapter } from '../../adapter.js'

function makeDb(): SqliteAdapter {
  const db = createTestAdapter()
  // exec is synchronous in our test adapter, safe to call outside async context
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

    // every 3rd point (index 0, 3, 6, 9)
    const sampled = await tpRepo.getTrackpointsSampled(actId, 3)
    expect(sampled.length).toBe(4)
    expect(sampled.map((p) => p.index)).toEqual([0, 3, 6, 9])
  })
})
```

**Step 3: Run tests**

```bash
pnpm --filter @traildiary/db test
```

Expected: all tests pass.

**Step 4: Commit**

```bash
git add packages/db/src/__tests__/
git commit -m "test(db): rewrite repository tests using better-sqlite3 adapter"
```

---

## Task 8: Create `ExpoSqliteAdapter` for mobile

**Files:**
- Create: `apps/mobile/src/infrastructure/expo-sqlite-adapter.ts`

`expo-sqlite`'s `SQLiteDatabase` API maps almost directly to our `SqliteAdapter`. Key notes:
- `runAsync(sql, params)` for writes
- `getFirstAsync<T>(sql, params)` returns `T | null`
- `getAllAsync<T>(sql, params)` returns `T[]`
- `execAsync(sql)` for DDL
- `withTransactionAsync(fn)` for transactions

**Step 1: Create file**

```typescript
// apps/mobile/src/infrastructure/expo-sqlite-adapter.ts
import type { SQLiteDatabase } from 'expo-sqlite'
import type { SqliteAdapter } from '@traildiary/db'

export class ExpoSqliteAdapter implements SqliteAdapter {
  constructor(private db: SQLiteDatabase) {}

  async run(sql: string, params: unknown[] = []): Promise<void> {
    await this.db.runAsync(sql, params)
  }

  async get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    const row = await this.db.getFirstAsync<T>(sql, params)
    return row ?? undefined
  }

  async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.db.getAllAsync<T>(sql, params)
  }

  async exec(sql: string): Promise<void> {
    await this.db.execAsync(sql)
  }

  async transaction(fn: () => Promise<void>): Promise<void> {
    await this.db.withTransactionAsync(fn)
  }
}
```

**Step 2: Commit**

```bash
git add apps/mobile/src/infrastructure/expo-sqlite-adapter.ts
git commit -m "feat(mobile): add ExpoSqliteAdapter"
```

---

## Task 9: Update mobile `sqlite-provider.tsx` and `di.ts`

**Files:**
- Modify: `apps/mobile/src/infrastructure/sqlite-provider.tsx`
- Modify: `apps/mobile/src/infrastructure/di.ts`

**Step 1: Rewrite `di.ts`**

```typescript
// apps/mobile/src/infrastructure/di.ts
import type { SQLiteDatabase } from 'expo-sqlite'
import type { Repositories } from '@traildiary/ui'
import {
  SqliteTrailRepository,
  SqliteTrailDayRepository,
  SqliteActivityRepository,
  SqliteTrackpointRepository,
} from '@traildiary/db'
import { ExpoSqliteAdapter } from './expo-sqlite-adapter'

export function createMobileRepositories(db: SQLiteDatabase): Repositories {
  const adapter = new ExpoSqliteAdapter(db)
  return {
    trails: new SqliteTrailRepository(adapter),
    trailDays: new SqliteTrailDayRepository(adapter),
    activities: new SqliteActivityRepository(adapter),
    trackpoints: new SqliteTrackpointRepository(adapter),
  }
}
```

**Step 2: Rewrite `sqlite-provider.tsx`** — replace embedded SQL with `SCHEMA_SQL` from `@traildiary/db`

```typescript
// apps/mobile/src/infrastructure/sqlite-provider.tsx
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import * as SQLite from 'expo-sqlite'
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { RepositoryProvider } from '@traildiary/ui'
import { SCHEMA_SQL } from '@traildiary/db'
import { createMobileRepositories } from './di'

export function SqliteProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    SQLite.openDatabaseAsync('traildiary.db')
      .then(async (database) => {
        await database.execAsync(SCHEMA_SQL)
        if (!cancelled) setDb(database)
      })
      .catch((e: unknown) => setError(String(e)))
    return () => { cancelled = true }
  }, [])

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Database error: {error}</Text>
      </View>
    )
  }

  if (!db) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#3b82f6" />
      </View>
    )
  }

  return (
    <RepositoryProvider repositories={createMobileRepositories(db)}>
      {children}
    </RepositoryProvider>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' },
  error: { color: '#ef4444', padding: 16 },
})
```

**Step 3: Commit**

```bash
git add apps/mobile/src/infrastructure/sqlite-provider.tsx apps/mobile/src/infrastructure/di.ts
git commit -m "feat(mobile): wire ExpoSqliteAdapter + shared repos from @traildiary/db"
```

---

## Task 10: Delete old mobile repository files

**Files to delete:**
- `apps/mobile/src/infrastructure/sqlite-trail-repository.ts`
- `apps/mobile/src/infrastructure/sqlite-activity-repository.ts`
- `apps/mobile/src/infrastructure/sqlite-trackpoint-repository.ts`

Also delete `apps/mobile/src/infrastructure/uuidv7.ts` — now re-exported from `@traildiary/db`.

**Step 1: Delete files**

```bash
git rm apps/mobile/src/infrastructure/sqlite-trail-repository.ts \
       apps/mobile/src/infrastructure/sqlite-activity-repository.ts \
       apps/mobile/src/infrastructure/sqlite-trackpoint-repository.ts \
       apps/mobile/src/infrastructure/uuidv7.ts
```

**Step 2: Commit**

```bash
git commit -m "chore(mobile): remove siloed SQLite repository implementations"
```

---

## Task 11: Add `wa-sqlite` to the web app

**Files:**
- Modify: `apps/web/package.json`
- Run: `pnpm install`

`wa-sqlite` persists data to IndexedDB via `IDBBatchAtomicVFS` — no COOP/COEP headers required, no Web Worker needed, runs in the main thread.

**Step 1: Update `package.json`**

Remove `@electric-sql/pglite`, add `wa-sqlite`:

```json
{
  "name": "@traildiary/web",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@tanstack/react-router": "^1.160.2",
    "@tanstack/router-devtools": "^1.160.2",
    "@traildiary/core": "workspace:*",
    "@traildiary/db": "workspace:*",
    "@traildiary/ui": "workspace:*",
    "maplibre-gl": "^5.18.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-map-gl": "^8.1.0",
    "recharts": "^3.7.0",
    "wa-sqlite": "^1.0.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@tanstack/router-plugin": "^1.160.2",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```

**Step 2: Update `vite.config.ts`** — swap PGlite exclusion for wa-sqlite

```typescript
// apps/web/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [TanStackRouterVite(), react(), tailwindcss()],
  build: {
    target: 'es2022',
  },
  esbuild: {
    target: 'es2022',
  },
  optimizeDeps: {
    exclude: ['wa-sqlite'],
    esbuildOptions: {
      target: 'es2022',
    },
  },
})
```

**Step 3: Install**

```bash
pnpm install
```

**Step 4: Commit**

```bash
git add apps/web/package.json apps/web/vite.config.ts
git commit -m "feat(web): add wa-sqlite, remove @electric-sql/pglite"
```

---

## Task 12: Create `WaSqliteAdapter` for web

**Files:**
- Create: `apps/web/src/infrastructure/wa-sqlite-adapter.ts`

`wa-sqlite` uses a low-level cursor API. The adapter wraps it into our clean `SqliteAdapter` interface. `IDBBatchAtomicVFS` stores pages in IndexedDB for durable persistence.

**Step 1: Create file**

```typescript
// apps/web/src/infrastructure/wa-sqlite-adapter.ts
import SQLiteAsyncESMFactory from 'wa-sqlite/dist/wa-sqlite-async.mjs'
import { IDBBatchAtomicVFS } from 'wa-sqlite/src/examples/IDBBatchAtomicVFS.js'
import * as SQLite from 'wa-sqlite'
import type { SqliteAdapter } from '@traildiary/db'

type SQLiteAPI = ReturnType<typeof SQLite.Factory>

class WaSqliteAdapter implements SqliteAdapter {
  constructor(
    private readonly sqlite3: SQLiteAPI,
    private readonly db: number,
  ) {}

  async run(sql: string, params: unknown[] = []): Promise<void> {
    await this._query(sql, params)
  }

  async get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    const rows = await this._query<T>(sql, params)
    return rows[0]
  }

  async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this._query<T>(sql, params)
  }

  async exec(sql: string): Promise<void> {
    await this.sqlite3.exec(this.db, sql)
  }

  async transaction(fn: () => Promise<void>): Promise<void> {
    await this.exec('BEGIN')
    try {
      await fn()
      await this.exec('COMMIT')
    } catch (e) {
      await this.exec('ROLLBACK')
      throw e
    }
  }

  private async _query<T>(sql: string, params: unknown[]): Promise<T[]> {
    const rows: T[] = []
    for await (const stmt of this.sqlite3.statements(this.db, sql)) {
      if (params.length > 0) {
        this.sqlite3.bind_collection(stmt, params as Parameters<SQLiteAPI['bind_collection']>[1])
      }
      let columns: string[] | undefined
      while ((await this.sqlite3.step(stmt)) === SQLite.SQLITE_ROW) {
        columns ??= this.sqlite3.column_names(stmt)
        const row: Record<string, unknown> = {}
        for (let i = 0; i < columns.length; i++) {
          row[columns[i]] = this.sqlite3.column(stmt, i)
        }
        rows.push(row as T)
      }
    }
    return rows
  }
}

export async function createWaSqliteAdapter(dbName = 'traildiary'): Promise<SqliteAdapter> {
  const module = await SQLiteAsyncESMFactory()
  const sqlite3 = SQLite.Factory(module)

  const vfs = await IDBBatchAtomicVFS.create(dbName, module)
  sqlite3.vfs_register(vfs, true)

  const db = await sqlite3.open_v2(dbName)

  return new WaSqliteAdapter(sqlite3, db)
}
```

**Step 2: Commit**

```bash
git add apps/web/src/infrastructure/wa-sqlite-adapter.ts
git commit -m "feat(web): add WaSqliteAdapter (wa-sqlite + IDBBatchAtomicVFS)"
```

---

## Task 13: Rewrite web `DbProvider` and `di.ts`

**Files:**
- Modify: `apps/web/src/application/providers/db-provider.tsx`
- Modify: `apps/web/src/infrastructure/di.ts`
- Modify: `apps/web/src/main.tsx`

**Step 1: Rewrite `di.ts`**

```typescript
// apps/web/src/infrastructure/di.ts
import type { Repositories } from '@traildiary/ui'
import {
  SqliteTrailRepository,
  SqliteTrailDayRepository,
  SqliteActivityRepository,
  SqliteTrackpointRepository,
  type SqliteAdapter,
} from '@traildiary/db'

export function createRepositories(adapter: SqliteAdapter): Repositories {
  return {
    trails: new SqliteTrailRepository(adapter),
    trailDays: new SqliteTrailDayRepository(adapter),
    activities: new SqliteActivityRepository(adapter),
    trackpoints: new SqliteTrackpointRepository(adapter),
  }
}
```

**Step 2: Rewrite `db-provider.tsx`**

```typescript
// apps/web/src/application/providers/db-provider.tsx
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { SCHEMA_SQL } from '@traildiary/db'
import { RepositoryProvider } from '@traildiary/ui'
import { createWaSqliteAdapter } from '../../infrastructure/wa-sqlite-adapter.js'
import { createRepositories } from '../../infrastructure/di.js'
import type { SqliteAdapter } from '@traildiary/db'

interface State {
  adapter: SqliteAdapter | null
  error: string | null
}

export function DbProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ adapter: null, error: null })

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const adapter = await createWaSqliteAdapter()
        await adapter.exec(SCHEMA_SQL)
        if (!cancelled) setState({ adapter, error: null })
      } catch (e) {
        if (!cancelled) setState({ adapter: null, error: String(e) })
      }
    }
    init()
    return () => { cancelled = true }
  }, [])

  const repositories = useMemo(
    () => state.adapter ? createRepositories(state.adapter) : null,
    [state.adapter],
  )

  if (state.error) {
    return (
      <div style={{ padding: 16, color: 'red' }}>
        Database error: {state.error}
      </div>
    )
  }

  if (!repositories) {
    return (
      <div style={{ padding: 16 }}>
        Loading database…
      </div>
    )
  }

  return (
    <RepositoryProvider repositories={repositories}>
      {children}
    </RepositoryProvider>
  )
}
```

**Step 3: Rewrite `main.tsx`** — remove `migrationSql` import

```typescript
// apps/web/src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen.js'
import { DbProvider } from './application/providers/db-provider.js'
import './app.css'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DbProvider>
      <RouterProvider router={router} />
    </DbProvider>
  </StrictMode>,
)
```

**Step 4: Commit**

```bash
git add apps/web/src/application/providers/db-provider.tsx \
        apps/web/src/infrastructure/di.ts \
        apps/web/src/main.tsx
git commit -m "feat(web): wire WaSqliteAdapter + shared repos from @traildiary/db"
```

---

## Task 14: Delete old PGlite files in `packages/db`

The old PGlite migration SQL file is no longer needed (schema is now `schema.ts`). The old `001-initial-schema.sql` should be removed to avoid confusion.

**Step 1: Delete**

```bash
git rm packages/db/src/migrations/001-initial-schema.sql
rmdir packages/db/src/migrations  # if now empty
```

**Step 2: Commit**

```bash
git commit -m "chore(db): remove PGlite PostgreSQL migration SQL"
```

---

## Task 15: Smoke test both platforms

**Mobile:**

```bash
pnpm mobile
# Open the app in Expo Go / simulator
# Navigate to Import screen, pick a GPX file, import it
# Verify trail appears on the home screen
# Kill app, reopen — data should persist
```

**Web:**

```bash
pnpm dev
# Open http://localhost:5173
# Import a GPX file
# Verify trail appears
# Hard-reload (Ctrl+Shift+R) — data should persist (IndexedDB via wa-sqlite)
```

**Final commit:**

```bash
git add -p  # stage any fixups
git commit -m "feat: SQLite shared repositories for mobile and web via packages/db"
```

---

## Architecture Diagram (After)

```
packages/db
├── adapter.ts          ← SqliteAdapter interface (port)
├── schema.ts           ← SCHEMA_SQL constant (shared DDL)
└── infrastructure/
    ├── trail-repository.ts        ← SqliteTrailRepository
    ├── activity-repository.ts     ← SqliteTrailDayRepository, SqliteActivityRepository
    └── trackpoint-repository.ts   ← SqliteTrackpointRepository

apps/mobile
└── src/infrastructure/
    ├── expo-sqlite-adapter.ts  ← wraps expo-sqlite → SqliteAdapter
    ├── sqlite-provider.tsx     ← opens DB, runs schema, injects repos
    └── di.ts                   ← wires adapter + repos

apps/web
└── src/infrastructure/
    ├── wa-sqlite-adapter.ts    ← wraps wa-sqlite + IDBBatchAtomicVFS → SqliteAdapter
    └── di.ts                   ← wires adapter + repos
```

Shared SQL logic: **100%** of queries. Per-platform code: **adapter only** (~30 lines each).
