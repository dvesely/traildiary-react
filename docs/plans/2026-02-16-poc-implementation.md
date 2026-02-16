# TrailDiary PoC Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a web app that parses GPX/FIT files from thru-hikes (30 days, multiple activities/day) and visualizes them on a map with elevation profiles and stats, persisted offline in PGlite.

**Architecture:** DDD + Hexagonal. Three packages: `packages/core` (pure domain logic, parsers), `packages/db` (PGlite repository adapters), `apps/web` (Vite + React UI). Dependency flows inward: infrastructure → application → domain.

**Tech Stack:** pnpm workspaces, TypeScript strict, Vite, React, TanStack Router, MapLibre GL JS, Recharts, Tailwind CSS, PGlite, Vitest.

**Design doc:** `docs/plans/2026-02-16-poc-design.md`

**Sample data:** `_data/tracks/` contains real TMB (7 FIT + 1 GPX) and PCT (2 GPX + 2 FIT) files for testing.

---

## Task 1: Monorepo Scaffolding

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/index.ts`
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/src/index.ts`
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Modify: `.gitignore` — replace with a clean monorepo gitignore (node_modules, dist, .env, etc.)

**Step 1: Create root package.json and workspace config**

`package.json`:
```json
{
  "name": "traildiary",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter @traildiary/web dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint"
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
  - "apps/*"
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "jsx": "react-jsx"
  }
}
```

**Step 2: Create packages/core scaffold**

`packages/core/package.json`:
```json
{
  "name": "@traildiary/core",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

`packages/core/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

`packages/core/src/index.ts`:
```ts
export {}
```

**Step 3: Create packages/db scaffold**

`packages/db/package.json`:
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
    "@electric-sql/pglite": "^0.2.0",
    "@traildiary/core": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

`packages/db/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

`packages/db/src/index.ts`:
```ts
export {}
```

**Step 4: Create apps/web scaffold**

`apps/web/package.json`:
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
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@traildiary/core": "workspace:*",
    "@traildiary/db": "workspace:*"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0"
  }
}
```

`apps/web/vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

`apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "noEmit": true
  },
  "include": ["src"]
}
```

`apps/web/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TrailDiary</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`apps/web/src/main.tsx`:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

function App() {
  return <div>TrailDiary</div>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

**Step 5: Replace .gitignore with clean monorepo version**

```gitignore
node_modules/
dist/
.env
.env.*
*.log
.DS_Store
.vscode/
.idea/
coverage/
```

**Step 6: Install dependencies and verify**

Run: `pnpm install`
Expected: All packages resolved, lockfile created.

Run: `pnpm --filter @traildiary/web dev`
Expected: Vite dev server starts, "TrailDiary" renders in browser.

**Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold monorepo with pnpm workspaces"
```

---

## Task 2: Domain Model (packages/core)

**Files:**
- Create: `packages/core/src/domain/trackpoint.ts`
- Create: `packages/core/src/domain/trail.ts`
- Create: `packages/core/src/domain/track-stats.ts`
- Test: `packages/core/src/__tests__/domain/track-stats.test.ts`

**Step 1: Write TrackPoint value object**

`packages/core/src/domain/trackpoint.ts`:
```ts
export interface TrackPoint {
  lat: number
  lon: number
  elevation: number
  timestamp: number
  heartRate?: number
  cadence?: number
}
```

**Step 2: Write Trail entities**

`packages/core/src/domain/trail.ts`:
```ts
import type { TrackPoint } from './trackpoint.js'
import type { TrackStats } from './track-stats.js'

export type SourceFormat = 'gpx' | 'fit'

export interface Activity {
  id: string
  trailDayId: string
  name: string
  sourceFormat: SourceFormat
  points: TrackPoint[]
  stats: TrackStats
  sortOrder: number
}

export interface TrailDay {
  id: string
  trailId: string
  name: string
  dayNumber: number
  activities: Activity[]
}

export interface Trail {
  id: string
  name: string
  days: TrailDay[]
  createdAt: Date
  updatedAt: Date
}
```

**Step 3: Write TrackStats value object and computation**

`packages/core/src/domain/track-stats.ts`:
```ts
import type { TrackPoint } from './trackpoint.js'

export interface TrackStats {
  distance: number
  elevationGain: number
  elevationLoss: number
  duration: number
  movingTime: number
  avgSpeed: number
  startTime: number
  endTime: number
}

const EARTH_RADIUS_KM = 6371

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function haversineDistance(a: TrackPoint, b: TrackPoint): number {
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const sinLat = Math.sin(dLat / 2)
  const sinLon = Math.sin(dLon / 2)
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLon * sinLon
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

function smoothElevations(points: TrackPoint[], windowSize: number = 5): number[] {
  const elevations = points.map((p) => p.elevation)
  const half = Math.floor(windowSize / 2)
  return elevations.map((_, i) => {
    const start = Math.max(0, i - half)
    const end = Math.min(elevations.length - 1, i + half)
    let sum = 0
    for (let j = start; j <= end; j++) sum += elevations[j]
    return sum / (end - start + 1)
  })
}

const MOVING_SPEED_THRESHOLD_KMH = 0.5

export function computeStats(points: TrackPoint[]): TrackStats {
  if (points.length === 0) {
    return {
      distance: 0, elevationGain: 0, elevationLoss: 0,
      duration: 0, movingTime: 0, avgSpeed: 0,
      startTime: 0, endTime: 0,
    }
  }

  let distance = 0
  let movingTime = 0
  const smoothed = smoothElevations(points)
  let elevationGain = 0
  let elevationLoss = 0

  for (let i = 1; i < points.length; i++) {
    const d = haversineDistance(points[i - 1], points[i])
    distance += d

    const dt = points[i].timestamp - points[i - 1].timestamp
    if (dt > 0) {
      const speedKmh = (d / dt) * 3_600_000
      if (speedKmh > MOVING_SPEED_THRESHOLD_KMH) {
        movingTime += dt
      }
    }

    const elevDiff = smoothed[i] - smoothed[i - 1]
    if (elevDiff > 0) elevationGain += elevDiff
    else elevationLoss += Math.abs(elevDiff)
  }

  const duration = points[points.length - 1].timestamp - points[0].timestamp
  const avgSpeed = movingTime > 0 ? (distance / movingTime) * 3_600_000 : 0

  return {
    distance,
    elevationGain,
    elevationLoss,
    duration,
    movingTime,
    avgSpeed,
    startTime: points[0].timestamp,
    endTime: points[points.length - 1].timestamp,
  }
}

export function aggregateStats(statsList: TrackStats[]): TrackStats {
  if (statsList.length === 0) {
    return {
      distance: 0, elevationGain: 0, elevationLoss: 0,
      duration: 0, movingTime: 0, avgSpeed: 0,
      startTime: 0, endTime: 0,
    }
  }

  const result = statsList.reduce(
    (acc, s) => ({
      distance: acc.distance + s.distance,
      elevationGain: acc.elevationGain + s.elevationGain,
      elevationLoss: acc.elevationLoss + s.elevationLoss,
      duration: acc.duration + s.duration,
      movingTime: acc.movingTime + s.movingTime,
      avgSpeed: 0,
      startTime: Math.min(acc.startTime, s.startTime),
      endTime: Math.max(acc.endTime, s.endTime),
    }),
    { distance: 0, elevationGain: 0, elevationLoss: 0, duration: 0, movingTime: 0, avgSpeed: 0, startTime: Infinity, endTime: 0 },
  )

  result.avgSpeed = result.movingTime > 0 ? (result.distance / result.movingTime) * 3_600_000 : 0
  return result
}
```

**Step 4: Write failing tests for stats computation**

`packages/core/src/__tests__/domain/track-stats.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { haversineDistance, computeStats, aggregateStats } from '../../domain/track-stats.js'
import type { TrackPoint } from '../../domain/trackpoint.js'

function makePoint(lat: number, lon: number, elevation: number, timestamp: number): TrackPoint {
  return { lat, lon, elevation, timestamp }
}

describe('haversineDistance', () => {
  it('returns 0 for same point', () => {
    const p = makePoint(50.0, 14.0, 200, 0)
    expect(haversineDistance(p, p)).toBe(0)
  })

  it('calculates known distance between Prague and Brno (~186km)', () => {
    const prague = makePoint(50.0755, 14.4378, 200, 0)
    const brno = makePoint(49.1951, 16.6068, 200, 0)
    const dist = haversineDistance(prague, brno)
    expect(dist).toBeGreaterThan(180)
    expect(dist).toBeLessThan(190)
  })
})

describe('computeStats', () => {
  it('returns zeros for empty points', () => {
    const stats = computeStats([])
    expect(stats.distance).toBe(0)
    expect(stats.elevationGain).toBe(0)
    expect(stats.duration).toBe(0)
  })

  it('computes distance for a simple track', () => {
    const points = [
      makePoint(50.0, 14.0, 200, 1000),
      makePoint(50.001, 14.0, 210, 2000),
      makePoint(50.002, 14.0, 205, 3000),
    ]
    const stats = computeStats(points)
    expect(stats.distance).toBeGreaterThan(0)
    expect(stats.elevationGain).toBeGreaterThan(0)
    expect(stats.duration).toBe(2000)
    expect(stats.startTime).toBe(1000)
    expect(stats.endTime).toBe(3000)
  })
})

describe('aggregateStats', () => {
  it('sums distances and elevations', () => {
    const s1 = { distance: 10, elevationGain: 500, elevationLoss: 300, duration: 3600000, movingTime: 3000000, avgSpeed: 12, startTime: 1000, endTime: 3601000 }
    const s2 = { distance: 15, elevationGain: 800, elevationLoss: 600, duration: 5400000, movingTime: 4500000, avgSpeed: 12, startTime: 4000000, endTime: 9400000 }
    const agg = aggregateStats([s1, s2])
    expect(agg.distance).toBe(25)
    expect(agg.elevationGain).toBe(1300)
    expect(agg.startTime).toBe(1000)
    expect(agg.endTime).toBe(9400000)
  })
})
```

**Step 5: Run tests to verify they pass**

Run: `cd packages/core && pnpm test`
Expected: All tests PASS.

**Step 6: Commit**

```bash
git add packages/core/src/domain packages/core/src/__tests__
git commit -m "feat(core): add domain model — TrackPoint, Trail entities, stats computation"
```

---

## Task 3: Track Simplification & Downsampling (packages/core)

**Files:**
- Create: `packages/core/src/domain/track-simplifier.ts`
- Create: `packages/core/src/domain/track-downsampler.ts`
- Test: `packages/core/src/__tests__/domain/track-simplifier.test.ts`
- Test: `packages/core/src/__tests__/domain/track-downsampler.test.ts`

**Step 1: Write failing test for Douglas-Peucker simplifier**

`packages/core/src/__tests__/domain/track-simplifier.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { simplifyTrack } from '../../domain/track-simplifier.js'
import type { TrackPoint } from '../../domain/trackpoint.js'

function makePoint(lat: number, lon: number): TrackPoint {
  return { lat, lon, elevation: 0, timestamp: 0 }
}

describe('simplifyTrack', () => {
  it('keeps start and end points', () => {
    const points = [makePoint(0, 0), makePoint(0.0001, 0), makePoint(1, 0)]
    const result = simplifyTrack(points, 0.001)
    expect(result[0]).toEqual(points[0])
    expect(result[result.length - 1]).toEqual(points[points.length - 1])
  })

  it('removes collinear points', () => {
    const points = [
      makePoint(0, 0),
      makePoint(0.5, 0),
      makePoint(1, 0),
    ]
    const result = simplifyTrack(points, 0.01)
    expect(result.length).toBe(2)
  })

  it('keeps points that deviate from the line', () => {
    const points = [
      makePoint(0, 0),
      makePoint(0.5, 1),
      makePoint(1, 0),
    ]
    const result = simplifyTrack(points, 0.01)
    expect(result.length).toBe(3)
  })

  it('returns original if 2 or fewer points', () => {
    const points = [makePoint(0, 0), makePoint(1, 1)]
    expect(simplifyTrack(points, 0.01)).toEqual(points)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- track-simplifier`
Expected: FAIL — module not found.

**Step 3: Implement Douglas-Peucker simplifier**

`packages/core/src/domain/track-simplifier.ts`:
```ts
import type { TrackPoint } from './trackpoint.js'

function perpendicularDistance(point: TrackPoint, lineStart: TrackPoint, lineEnd: TrackPoint): number {
  const dx = lineEnd.lat - lineStart.lat
  const dy = lineEnd.lon - lineStart.lon

  if (dx === 0 && dy === 0) {
    const pdx = point.lat - lineStart.lat
    const pdy = point.lon - lineStart.lon
    return Math.sqrt(pdx * pdx + pdy * pdy)
  }

  const t = ((point.lat - lineStart.lat) * dx + (point.lon - lineStart.lon) * dy) / (dx * dx + dy * dy)
  const closestLat = lineStart.lat + t * dx
  const closestLon = lineStart.lon + t * dy
  const pdx = point.lat - closestLat
  const pdy = point.lon - closestLon
  return Math.sqrt(pdx * pdx + pdy * pdy)
}

export function simplifyTrack(points: TrackPoint[], tolerance: number): TrackPoint[] {
  if (points.length <= 2) return points

  let maxDist = 0
  let maxIdx = 0

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[points.length - 1])
    if (dist > maxDist) {
      maxDist = dist
      maxIdx = i
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyTrack(points.slice(0, maxIdx + 1), tolerance)
    const right = simplifyTrack(points.slice(maxIdx), tolerance)
    return [...left.slice(0, -1), ...right]
  }

  return [points[0], points[points.length - 1]]
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- track-simplifier`
Expected: PASS.

**Step 5: Write failing test for LTTB downsampler**

`packages/core/src/__tests__/domain/track-downsampler.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { downsampleForChart } from '../../domain/track-downsampler.js'
import type { TrackPoint } from '../../domain/trackpoint.js'

function makePoints(count: number): TrackPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    lat: 50 + i * 0.001,
    lon: 14,
    elevation: Math.sin(i / 10) * 100 + 500,
    timestamp: i * 1000,
  }))
}

describe('downsampleForChart', () => {
  it('returns original if count <= target', () => {
    const points = makePoints(10)
    expect(downsampleForChart(points, 20)).toEqual(points)
  })

  it('reduces to target count', () => {
    const points = makePoints(1000)
    const result = downsampleForChart(points, 100)
    expect(result.length).toBe(100)
  })

  it('preserves first and last points', () => {
    const points = makePoints(500)
    const result = downsampleForChart(points, 50)
    expect(result[0]).toEqual(points[0])
    expect(result[result.length - 1]).toEqual(points[points.length - 1])
  })
})
```

**Step 6: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- track-downsampler`
Expected: FAIL.

**Step 7: Implement LTTB downsampler**

`packages/core/src/domain/track-downsampler.ts`:
```ts
import type { TrackPoint } from './trackpoint.js'

export function downsampleForChart(points: TrackPoint[], targetCount: number): TrackPoint[] {
  if (points.length <= targetCount) return points

  const sampled: TrackPoint[] = [points[0]]
  const bucketSize = (points.length - 2) / (targetCount - 2)

  let prevIndex = 0

  for (let i = 0; i < targetCount - 2; i++) {
    const bucketStart = Math.floor((i + 1) * bucketSize) + 1
    const bucketEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, points.length - 1)

    let avgLat = 0
    let avgElevation = 0
    const nextBucketCount = bucketEnd - bucketStart
    for (let j = bucketStart; j < bucketEnd; j++) {
      avgLat += points[j].lat
      avgElevation += points[j].elevation
    }
    avgLat /= nextBucketCount || 1
    avgElevation /= nextBucketCount || 1

    const rangeStart = Math.floor(i * bucketSize) + 1
    const rangeEnd = Math.floor((i + 1) * bucketSize) + 1

    let maxArea = -1
    let maxIdx = rangeStart

    const prevPoint = points[prevIndex]

    for (let j = rangeStart; j < rangeEnd && j < points.length - 1; j++) {
      const area = Math.abs(
        (prevPoint.lat - avgLat) * (points[j].elevation - prevPoint.elevation) -
        (prevPoint.lat - points[j].lat) * (avgElevation - prevPoint.elevation)
      )
      if (area > maxArea) {
        maxArea = area
        maxIdx = j
      }
    }

    sampled.push(points[maxIdx])
    prevIndex = maxIdx
  }

  sampled.push(points[points.length - 1])
  return sampled
}
```

**Step 8: Run tests to verify they pass**

Run: `cd packages/core && pnpm test`
Expected: All tests PASS.

**Step 9: Commit**

```bash
git add packages/core/src/domain/track-simplifier.ts packages/core/src/domain/track-downsampler.ts packages/core/src/__tests__
git commit -m "feat(core): add Douglas-Peucker simplifier and LTTB downsampler"
```

---

## Task 4: GPX Parser (packages/core)

**Files:**
- Create: `packages/core/src/application/ports.ts`
- Create: `packages/core/src/infrastructure/gpx-parser.ts`
- Test: `packages/core/src/__tests__/infrastructure/gpx-parser.test.ts`

**Step 1: Define parser port**

`packages/core/src/application/ports.ts`:
```ts
import type { TrackPoint } from '../domain/trackpoint.js'
import type { SourceFormat } from '../domain/trail.js'

export interface ParsedActivity {
  name: string
  sourceFormat: SourceFormat
  points: TrackPoint[]
}

export interface FileParser {
  canParse(fileName: string): boolean
  parse(data: ArrayBuffer, fileName: string): Promise<ParsedActivity[]>
}

export interface TrailRepository {
  createTrail(name: string): Promise<string>
  getTrail(id: string): Promise<{ id: string; name: string } | null>
  listTrails(): Promise<Array<{ id: string; name: string }>>
}

export interface TrailDayRepository {
  createTrailDay(trailId: string, name: string, dayNumber: number): Promise<string>
  getTrailDays(trailId: string): Promise<Array<{ id: string; name: string; dayNumber: number }>>
}

export interface ActivityRepository {
  createActivity(trailDayId: string, name: string, sourceFormat: SourceFormat, stats: import('../domain/track-stats.js').TrackStats, sortOrder: number): Promise<string>
  getActivities(trailDayId: string): Promise<Array<{ id: string; name: string; sourceFormat: SourceFormat; stats: import('../domain/track-stats.js').TrackStats; sortOrder: number }>>
}

export interface TrackpointRepository {
  insertTrackpoints(activityId: string, points: TrackPoint[]): Promise<void>
  getTrackpoints(activityId: string): Promise<TrackPoint[]>
  getTrackpointsSampled(activityId: string, sampleRate: number): Promise<TrackPoint[]>
}
```

**Step 2: Write failing test for GPX parser using sample file**

`packages/core/src/__tests__/infrastructure/gpx-parser.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { GpxParser } from '../../infrastructure/gpx-parser.js'

const SAMPLE_GPX_PATH = resolve(__dirname, '../../../../_data/tracks/TMB_VII_Konec_posledních_7_km.gpx')

describe('GpxParser', () => {
  const parser = new GpxParser()

  it('canParse returns true for .gpx files', () => {
    expect(parser.canParse('track.gpx')).toBe(true)
    expect(parser.canParse('track.GPX')).toBe(true)
    expect(parser.canParse('track.fit')).toBe(false)
  })

  it('parses a real GPX file', async () => {
    const buffer = readFileSync(SAMPLE_GPX_PATH)
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    const activities = await parser.parse(arrayBuffer, 'TMB_VII_Konec_posledních_7_km.gpx')

    expect(activities.length).toBeGreaterThan(0)
    expect(activities[0].sourceFormat).toBe('gpx')
    expect(activities[0].points.length).toBeGreaterThan(0)

    const point = activities[0].points[0]
    expect(point.lat).toBeTypeOf('number')
    expect(point.lon).toBeTypeOf('number')
    expect(point.elevation).toBeTypeOf('number')
  })
})
```

**Step 3: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- gpx-parser`
Expected: FAIL.

**Step 4: Implement GPX parser**

`packages/core/src/infrastructure/gpx-parser.ts`:
```ts
import type { TrackPoint } from '../domain/trackpoint.js'
import type { FileParser, ParsedActivity } from '../application/ports.js'

export class GpxParser implements FileParser {
  canParse(fileName: string): boolean {
    return fileName.toLowerCase().endsWith('.gpx')
  }

  async parse(data: ArrayBuffer, fileName: string): Promise<ParsedActivity[]> {
    const text = new TextDecoder().decode(data)
    // Use DOMParser in browser, xmldom in Node/tests
    let doc: Document
    if (typeof DOMParser !== 'undefined') {
      doc = new DOMParser().parseFromString(text, 'application/xml')
    } else {
      const { JSDOM } = await import('jsdom')
      doc = new JSDOM(text, { contentType: 'application/xml' }).window.document
    }

    const tracks = doc.getElementsByTagName('trk')
    const activities: ParsedActivity[] = []

    for (let t = 0; t < tracks.length; t++) {
      const track = tracks[t]
      const nameEl = track.getElementsByTagName('name')[0]
      const name = nameEl?.textContent ?? fileName.replace(/\.gpx$/i, '')

      const points: TrackPoint[] = []
      const trkpts = track.getElementsByTagName('trkpt')

      for (let i = 0; i < trkpts.length; i++) {
        const pt = trkpts[i]
        const lat = parseFloat(pt.getAttribute('lat') ?? '0')
        const lon = parseFloat(pt.getAttribute('lon') ?? '0')
        const eleEl = pt.getElementsByTagName('ele')[0]
        const elevation = eleEl ? parseFloat(eleEl.textContent ?? '0') : 0
        const timeEl = pt.getElementsByTagName('time')[0]
        const timestamp = timeEl ? new Date(timeEl.textContent ?? '').getTime() : 0

        const hrEl = pt.getElementsByTagName('gpxtpx:hr')[0] ?? pt.getElementsByTagName('hr')[0]
        const cadEl = pt.getElementsByTagName('gpxtpx:cad')[0] ?? pt.getElementsByTagName('cad')[0]

        points.push({
          lat,
          lon,
          elevation,
          timestamp,
          heartRate: hrEl ? parseInt(hrEl.textContent ?? '0', 10) : undefined,
          cadence: cadEl ? parseInt(cadEl.textContent ?? '0', 10) : undefined,
        })
      }

      activities.push({ name, sourceFormat: 'gpx', points })
    }

    return activities
  }
}
```

Note: In test environment, we need `jsdom` as a dev dependency. Add it:

Run: `cd packages/core && pnpm add -D jsdom @types/jsdom`

**Step 5: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- gpx-parser`
Expected: PASS.

**Step 6: Commit**

```bash
git add packages/core/src/application/ports.ts packages/core/src/infrastructure/gpx-parser.ts packages/core/src/__tests__ packages/core/package.json
git commit -m "feat(core): add GPX parser with file parser port"
```

---

## Task 5: FIT Parser (packages/core)

**Files:**
- Create: `packages/core/src/infrastructure/fit-parser.ts`
- Test: `packages/core/src/__tests__/infrastructure/fit-parser.test.ts`

**Step 1: Install fit-file-parser**

Run: `cd packages/core && pnpm add fit-file-parser`

**Step 2: Write failing test using sample FIT file**

`packages/core/src/__tests__/infrastructure/fit-parser.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FitParser } from '../../infrastructure/fit-parser.js'

const SAMPLE_FIT_PATH = resolve(__dirname, '../../../../_data/tracks/TMB_I_.fit')

describe('FitParser', () => {
  const parser = new FitParser()

  it('canParse returns true for .fit files', () => {
    expect(parser.canParse('track.fit')).toBe(true)
    expect(parser.canParse('track.FIT')).toBe(true)
    expect(parser.canParse('track.gpx')).toBe(false)
  })

  it('parses a real FIT file', async () => {
    const buffer = readFileSync(SAMPLE_FIT_PATH)
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    const activities = await parser.parse(arrayBuffer, 'TMB_I_.fit')

    expect(activities.length).toBeGreaterThan(0)
    expect(activities[0].sourceFormat).toBe('fit')
    expect(activities[0].points.length).toBeGreaterThan(0)

    const point = activities[0].points[0]
    expect(point.lat).toBeTypeOf('number')
    expect(point.lon).toBeTypeOf('number')
    expect(point.lat).toBeGreaterThan(40)
    expect(point.lat).toBeLessThan(50)
  })
})
```

**Step 3: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- fit-parser`
Expected: FAIL.

**Step 4: Implement FIT parser**

`packages/core/src/infrastructure/fit-parser.ts`:
```ts
import FitFileParser from 'fit-file-parser'
import type { TrackPoint } from '../domain/trackpoint.js'
import type { FileParser, ParsedActivity } from '../application/ports.js'

export class FitParser implements FileParser {
  canParse(fileName: string): boolean {
    return fileName.toLowerCase().endsWith('.fit')
  }

  async parse(data: ArrayBuffer, fileName: string): Promise<ParsedActivity[]> {
    const parser = new FitFileParser({ speedUnit: 'km/h', lengthUnit: 'km' })
    parser.parse(Buffer.from(data))
    const fitData = parser.toJSON()

    const name = fileName.replace(/\.fit$/i, '')
    const points: TrackPoint[] = []

    const records = fitData.records ?? []
    for (const record of records) {
      if (record.position_lat == null || record.position_long == null) continue

      points.push({
        lat: record.position_lat,
        lon: record.position_long,
        elevation: record.enhanced_altitude ?? record.altitude ?? 0,
        timestamp: record.timestamp ? new Date(record.timestamp).getTime() : 0,
        heartRate: record.heart_rate ?? undefined,
        cadence: record.cadence ?? undefined,
      })
    }

    return [{ name, sourceFormat: 'fit', points }]
  }
}
```

Note: `fit-file-parser` may need type declarations. If no `@types/fit-file-parser` exists, create a local declaration:

`packages/core/src/types/fit-file-parser.d.ts`:
```ts
declare module 'fit-file-parser' {
  interface FitParserOptions {
    speedUnit?: string
    lengthUnit?: string
  }
  class FitFileParser {
    constructor(options?: FitParserOptions)
    parse(buffer: Buffer): void
    toJSON(): {
      records?: Array<{
        position_lat?: number
        position_long?: number
        altitude?: number
        enhanced_altitude?: number
        timestamp?: string
        heart_rate?: number
        cadence?: number
        [key: string]: unknown
      }>
      [key: string]: unknown
    }
  }
  export default FitFileParser
}
```

**Step 5: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- fit-parser`
Expected: PASS.

**Step 6: Commit**

```bash
git add packages/core/src/infrastructure/fit-parser.ts packages/core/src/__tests__ packages/core/src/types packages/core/package.json
git commit -m "feat(core): add FIT parser"
```

---

## Task 6: Core Public API & Export (packages/core)

**Files:**
- Modify: `packages/core/src/index.ts`

**Step 1: Wire up all exports**

`packages/core/src/index.ts`:
```ts
// Domain
export type { TrackPoint } from './domain/trackpoint.js'
export type { Trail, TrailDay, Activity, SourceFormat } from './domain/trail.js'
export type { TrackStats } from './domain/track-stats.js'
export { haversineDistance, computeStats, aggregateStats } from './domain/track-stats.js'
export { simplifyTrack } from './domain/track-simplifier.js'
export { downsampleForChart } from './domain/track-downsampler.js'

// Application
export type { FileParser, ParsedActivity, TrailRepository, TrailDayRepository, ActivityRepository, TrackpointRepository } from './application/ports.js'

// Infrastructure
export { GpxParser } from './infrastructure/gpx-parser.js'
export { FitParser } from './infrastructure/fit-parser.js'
```

**Step 2: Run all core tests**

Run: `cd packages/core && pnpm test`
Expected: All PASS.

**Step 3: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): wire up public API exports"
```

---

## Task 7: Database Package (packages/db)

**Files:**
- Create: `packages/db/src/migrations/001-initial-schema.sql`
- Create: `packages/db/src/infrastructure/pglite-client.ts`
- Create: `packages/db/src/infrastructure/trail-repository.ts`
- Create: `packages/db/src/infrastructure/activity-repository.ts`
- Create: `packages/db/src/infrastructure/trackpoint-repository.ts`
- Modify: `packages/db/src/index.ts`
- Test: `packages/db/src/__tests__/infrastructure/repositories.test.ts`

**Step 1: Create migration SQL**

`packages/db/src/migrations/001-initial-schema.sql`:
```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE trails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE trail_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trail_id UUID REFERENCES trails(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  day_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trail_day_id UUID REFERENCES trail_days(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_format TEXT NOT NULL,
  distance_km REAL,
  elevation_gain_m REAL,
  elevation_loss_m REAL,
  duration_ms BIGINT,
  moving_time_ms BIGINT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE trackpoints (
  id BIGSERIAL PRIMARY KEY,
  activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  elevation REAL,
  timestamp TIMESTAMPTZ,
  heart_rate SMALLINT,
  cadence SMALLINT,
  point_index INTEGER NOT NULL
);

CREATE INDEX idx_trackpoints_activity ON trackpoints(activity_id);
CREATE INDEX idx_activities_trail_day ON activities(trail_day_id);
CREATE INDEX idx_trail_days_trail ON trail_days(trail_id);
```

**Step 2: Create PGlite client**

`packages/db/src/infrastructure/pglite-client.ts`:
```ts
import { PGlite } from '@electric-sql/pglite'

let instance: PGlite | null = null

export async function getPgliteClient(dataDir?: string): Promise<PGlite> {
  if (instance) return instance
  instance = new PGlite(dataDir ?? 'idb://traildiary')
  return instance
}

export async function runMigrations(client: PGlite, sql: string): Promise<void> {
  await client.exec(sql)
}

export async function resetClient(): Promise<void> {
  if (instance) {
    await instance.close()
    instance = null
  }
}
```

**Step 3: Implement trail repository**

`packages/db/src/infrastructure/trail-repository.ts`:
```ts
import type { PGlite } from '@electric-sql/pglite'
import type { TrailRepository } from '@traildiary/core'

export class PgliteTrailRepository implements TrailRepository {
  constructor(private db: PGlite) {}

  async createTrail(name: string): Promise<string> {
    const result = await this.db.query<{ id: string }>(
      'INSERT INTO trails (name) VALUES ($1) RETURNING id',
      [name]
    )
    return result.rows[0].id
  }

  async getTrail(id: string): Promise<{ id: string; name: string } | null> {
    const result = await this.db.query<{ id: string; name: string }>(
      'SELECT id, name FROM trails WHERE id = $1',
      [id]
    )
    return result.rows[0] ?? null
  }

  async listTrails(): Promise<Array<{ id: string; name: string }>> {
    const result = await this.db.query<{ id: string; name: string }>(
      'SELECT id, name FROM trails ORDER BY created_at DESC'
    )
    return result.rows
  }
}
```

**Step 4: Implement activity repository**

`packages/db/src/infrastructure/activity-repository.ts`:
```ts
import type { PGlite } from '@electric-sql/pglite'
import type { ActivityRepository, TrailDayRepository, SourceFormat, TrackStats } from '@traildiary/core'

export class PgliteTrailDayRepository implements TrailDayRepository {
  constructor(private db: PGlite) {}

  async createTrailDay(trailId: string, name: string, dayNumber: number): Promise<string> {
    const result = await this.db.query<{ id: string }>(
      'INSERT INTO trail_days (trail_id, name, day_number) VALUES ($1, $2, $3) RETURNING id',
      [trailId, name, dayNumber]
    )
    return result.rows[0].id
  }

  async getTrailDays(trailId: string): Promise<Array<{ id: string; name: string; dayNumber: number }>> {
    const result = await this.db.query<{ id: string; name: string; day_number: number }>(
      'SELECT id, name, day_number FROM trail_days WHERE trail_id = $1 ORDER BY day_number',
      [trailId]
    )
    return result.rows.map((r) => ({ id: r.id, name: r.name, dayNumber: r.day_number }))
  }
}

export class PgliteActivityRepository implements ActivityRepository {
  constructor(private db: PGlite) {}

  async createActivity(
    trailDayId: string,
    name: string,
    sourceFormat: SourceFormat,
    stats: TrackStats,
    sortOrder: number,
  ): Promise<string> {
    const result = await this.db.query<{ id: string }>(
      `INSERT INTO activities (trail_day_id, name, source_format, distance_km, elevation_gain_m, elevation_loss_m, duration_ms, moving_time_ms, start_time, end_time, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, to_timestamp($9::double precision / 1000), to_timestamp($10::double precision / 1000), $11)
       RETURNING id`,
      [trailDayId, name, sourceFormat, stats.distance, stats.elevationGain, stats.elevationLoss, stats.duration, stats.movingTime, stats.startTime, stats.endTime, sortOrder]
    )
    return result.rows[0].id
  }

  async getActivities(trailDayId: string): Promise<Array<{ id: string; name: string; sourceFormat: SourceFormat; stats: TrackStats; sortOrder: number }>> {
    const result = await this.db.query<{
      id: string; name: string; source_format: string
      distance_km: number; elevation_gain_m: number; elevation_loss_m: number
      duration_ms: string; moving_time_ms: string; start_time: string; end_time: string
      sort_order: number
    }>(
      'SELECT * FROM activities WHERE trail_day_id = $1 ORDER BY sort_order',
      [trailDayId]
    )
    return result.rows.map((r) => ({
      id: r.id,
      name: r.name,
      sourceFormat: r.source_format as SourceFormat,
      stats: {
        distance: r.distance_km,
        elevationGain: r.elevation_gain_m,
        elevationLoss: r.elevation_loss_m,
        duration: Number(r.duration_ms),
        movingTime: Number(r.moving_time_ms),
        avgSpeed: Number(r.moving_time_ms) > 0 ? (r.distance_km / Number(r.moving_time_ms)) * 3_600_000 : 0,
        startTime: new Date(r.start_time).getTime(),
        endTime: new Date(r.end_time).getTime(),
      },
      sortOrder: r.sort_order,
    }))
  }
}
```

**Step 5: Implement trackpoint repository**

`packages/db/src/infrastructure/trackpoint-repository.ts`:
```ts
import type { PGlite } from '@electric-sql/pglite'
import type { TrackpointRepository, TrackPoint } from '@traildiary/core'

export class PgliteTrackpointRepository implements TrackpointRepository {
  constructor(private db: PGlite) {}

  async insertTrackpoints(activityId: string, points: TrackPoint[]): Promise<void> {
    const batchSize = 500
    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize)
      const values: unknown[] = []
      const placeholders: string[] = []

      batch.forEach((p, idx) => {
        const offset = idx * 7
        placeholders.push(
          `($1, $${offset + 2}, $${offset + 3}, $${offset + 4}, ${p.timestamp ? `to_timestamp($${offset + 5}::double precision / 1000)` : 'NULL'}, $${offset + 6}, $${offset + 7}, $${offset + 8})`
        )
        values.push(
          p.lat, p.lon, p.elevation, p.timestamp || null,
          p.heartRate ?? null, p.cadence ?? null, i + idx
        )
      })

      await this.db.query(
        `INSERT INTO trackpoints (activity_id, lat, lon, elevation, timestamp, heart_rate, cadence, point_index) VALUES ${placeholders.join(', ')}`,
        [activityId, ...values]
      )
    }
  }

  async getTrackpoints(activityId: string): Promise<TrackPoint[]> {
    const result = await this.db.query<{
      lat: number; lon: number; elevation: number
      timestamp: string | null; heart_rate: number | null; cadence: number | null
    }>(
      'SELECT lat, lon, elevation, timestamp, heart_rate, cadence FROM trackpoints WHERE activity_id = $1 ORDER BY point_index',
      [activityId]
    )
    return result.rows.map((r) => ({
      lat: r.lat,
      lon: r.lon,
      elevation: r.elevation,
      timestamp: r.timestamp ? new Date(r.timestamp).getTime() : 0,
      heartRate: r.heart_rate ?? undefined,
      cadence: r.cadence ?? undefined,
    }))
  }

  async getTrackpointsSampled(activityId: string, sampleRate: number): Promise<TrackPoint[]> {
    const result = await this.db.query<{
      lat: number; lon: number; elevation: number
      timestamp: string | null; heart_rate: number | null; cadence: number | null
    }>(
      'SELECT lat, lon, elevation, timestamp, heart_rate, cadence FROM trackpoints WHERE activity_id = $1 AND point_index % $2 = 0 ORDER BY point_index',
      [activityId, sampleRate]
    )
    return result.rows.map((r) => ({
      lat: r.lat,
      lon: r.lon,
      elevation: r.elevation,
      timestamp: r.timestamp ? new Date(r.timestamp).getTime() : 0,
      heartRate: r.heart_rate ?? undefined,
      cadence: r.cadence ?? undefined,
    }))
  }
}
```

**Step 6: Wire up db exports**

`packages/db/src/index.ts`:
```ts
export { getPgliteClient, runMigrations, resetClient } from './infrastructure/pglite-client.js'
export { PgliteTrailRepository } from './infrastructure/trail-repository.js'
export { PgliteTrailDayRepository, PgliteActivityRepository } from './infrastructure/activity-repository.js'
export { PgliteTrackpointRepository } from './infrastructure/trackpoint-repository.js'
```

**Step 7: Write integration test**

`packages/db/src/__tests__/infrastructure/repositories.test.ts`:
```ts
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
```

**Step 8: Run tests**

Run: `cd packages/db && pnpm test`
Expected: All PASS.

**Step 9: Commit**

```bash
git add packages/db
git commit -m "feat(db): add PGlite client, repositories, and migration schema"
```

---

## Task 8: Web App Shell — Vite + React + TanStack Router + Tailwind

**Files:**
- Modify: `apps/web/src/main.tsx`
- Create: `apps/web/src/app.css`
- Create: `apps/web/src/routes/__root.tsx`
- Create: `apps/web/src/routes/index.tsx`
- Create: `apps/web/src/routes/trail.$trailId.tsx`
- Create: `apps/web/src/ui/layout/app-layout.tsx`

**Step 1: Install TanStack Router and MapLibre dependencies**

Run: `cd apps/web && pnpm add @tanstack/react-router @tanstack/router-devtools maplibre-gl react-map-gl recharts`

Run: `cd apps/web && pnpm add -D @tanstack/router-plugin`

**Step 2: Update vite.config.ts for TanStack Router plugin**

`apps/web/vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [TanStackRouterVite(), react(), tailwindcss()],
})
```

**Step 3: Create app CSS with Tailwind import**

`apps/web/src/app.css`:
```css
@import "tailwindcss";
@import "maplibre-gl/dist/maplibre-gl.css";
```

**Step 4: Create root route with layout**

`apps/web/src/routes/__root.tsx`:
```tsx
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { AppLayout } from '../ui/layout/app-layout.js'

export const Route = createRootRoute({
  component: () => (
    <AppLayout>
      <Outlet />
    </AppLayout>
  ),
})
```

`apps/web/src/ui/layout/app-layout.tsx`:
```tsx
import type { ReactNode } from 'react'

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100">
      <header className="h-12 flex items-center px-4 border-b border-gray-800">
        <h1 className="text-lg font-semibold">TrailDiary</h1>
      </header>
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
```

**Step 5: Create index route (home page placeholder)**

`apps/web/src/routes/index.tsx`:
```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-gray-400">Drop GPX/FIT files here to get started</p>
    </div>
  )
}
```

**Step 6: Create trail route placeholder**

`apps/web/src/routes/trail.$trailId.tsx`:
```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/trail/$trailId')({
  component: TrailPage,
})

function TrailPage() {
  const { trailId } = Route.useParams()
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-gray-400">Trail: {trailId}</p>
    </div>
  )
}
```

**Step 7: Update main.tsx with router**

`apps/web/src/main.tsx`:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen.js'
import './app.css'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)
```

**Step 8: Run dev server and verify**

Run: `pnpm --filter @traildiary/web dev`
Expected: App loads with header "TrailDiary" and placeholder text. Navigation to `/trail/test` shows "Trail: test".

**Step 9: Commit**

```bash
git add apps/web
git commit -m "feat(web): add app shell with TanStack Router, Tailwind, layout"
```

---

## Task 9: PGlite Provider & DB Initialization (apps/web)

**Files:**
- Create: `apps/web/src/application/providers/db-provider.tsx`
- Create: `apps/web/src/infrastructure/di.ts`
- Modify: `apps/web/src/main.tsx`

**Step 1: Create DB provider**

`apps/web/src/application/providers/db-provider.tsx`:
```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { PGlite } from '@electric-sql/pglite'
import { getPgliteClient, runMigrations } from '@traildiary/db'

interface DbContextValue {
  db: PGlite | null
  isReady: boolean
}

const DbContext = createContext<DbContextValue>({ db: null, isReady: false })

export function useDb() {
  const ctx = useContext(DbContext)
  if (!ctx.isReady) throw new Error('Database not ready')
  return ctx.db!
}

export function useDbStatus() {
  return useContext(DbContext)
}

export function DbProvider({ children, migrationSql }: { children: ReactNode; migrationSql: string }) {
  const [state, setState] = useState<DbContextValue>({ db: null, isReady: false })

  useEffect(() => {
    let cancelled = false
    async function init() {
      const client = await getPgliteClient('idb://traildiary')
      await runMigrations(client, migrationSql)
      if (!cancelled) setState({ db: client, isReady: true })
    }
    init()
    return () => { cancelled = true }
  }, [migrationSql])

  return <DbContext.Provider value={state}>{children}</DbContext.Provider>
}
```

**Step 2: Create DI wiring**

`apps/web/src/infrastructure/di.ts`:
```ts
import type { PGlite } from '@electric-sql/pglite'
import { PgliteTrailRepository, PgliteTrailDayRepository, PgliteActivityRepository, PgliteTrackpointRepository } from '@traildiary/db'

export function createRepositories(db: PGlite) {
  return {
    trails: new PgliteTrailRepository(db),
    trailDays: new PgliteTrailDayRepository(db),
    activities: new PgliteActivityRepository(db),
    trackpoints: new PgliteTrackpointRepository(db),
  }
}
```

**Step 3: Update main.tsx to include DbProvider**

`apps/web/src/main.tsx`:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen.js'
import { DbProvider } from './application/providers/db-provider.js'
import migrationSql from '@traildiary/db/src/migrations/001-initial-schema.sql?raw'
import './app.css'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DbProvider migrationSql={migrationSql}>
      <RouterProvider router={router} />
    </DbProvider>
  </StrictMode>
)
```

**Step 4: Verify dev server still works with PGlite**

Run: `pnpm --filter @traildiary/web dev`
Expected: App loads without errors. Check browser console — no PGlite errors.

**Step 5: Commit**

```bash
git add apps/web/src/application apps/web/src/infrastructure apps/web/src/main.tsx
git commit -m "feat(web): add PGlite provider and DI wiring"
```

---

## Task 10: File Drop Zone & Import Flow (apps/web)

**Files:**
- Create: `apps/web/src/ui/components/file-drop-zone.tsx`
- Create: `apps/web/src/application/hooks/use-import.ts`
- Modify: `apps/web/src/routes/index.tsx`

**Step 1: Create file drop zone component**

`apps/web/src/ui/components/file-drop-zone.tsx`:
```tsx
import { useCallback, useState, type DragEvent } from 'react'

interface FileDropZoneProps {
  onFiles: (files: File[]) => void
  disabled?: boolean
}

export function FileDropZone({ onFiles, disabled }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDrag = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragIn = useCallback((e: DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragOut = useCallback((e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (disabled) return
      const files = Array.from(e.dataTransfer.files).filter(
        (f) => f.name.toLowerCase().endsWith('.gpx') || f.name.toLowerCase().endsWith('.fit')
      )
      if (files.length > 0) onFiles(files)
    },
    [onFiles, disabled]
  )

  const handleClick = useCallback(() => {
    if (disabled) return
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = '.gpx,.fit'
    input.onchange = () => {
      const files = Array.from(input.files ?? [])
      if (files.length > 0) onFiles(files)
    }
    input.click()
  }, [onFiles, disabled])

  return (
    <div
      onDragOver={handleDrag}
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`
        flex flex-col items-center justify-center gap-4 p-12
        border-2 border-dashed rounded-xl cursor-pointer transition-colors
        ${isDragging ? 'border-blue-400 bg-blue-400/10' : 'border-gray-600 hover:border-gray-400'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <p className="text-lg text-gray-300">Drop GPX/FIT files here</p>
      <p className="text-sm text-gray-500">or click to browse</p>
    </div>
  )
}
```

**Step 2: Create import hook**

`apps/web/src/application/hooks/use-import.ts`:
```tsx
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { GpxParser, FitParser, computeStats } from '@traildiary/core'
import { useDb } from '../providers/db-provider.js'
import { createRepositories } from '../../infrastructure/di.js'

interface ImportProgress {
  status: 'idle' | 'parsing' | 'saving' | 'done' | 'error'
  current: number
  total: number
  message: string
}

const parsers = [new GpxParser(), new FitParser()]

export function useImport() {
  const db = useDb()
  const navigate = useNavigate()
  const [progress, setProgress] = useState<ImportProgress>({
    status: 'idle', current: 0, total: 0, message: '',
  })

  async function importFiles(trailName: string, files: File[]) {
    const repos = createRepositories(db)
    const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name))

    setProgress({ status: 'parsing', current: 0, total: sorted.length, message: 'Starting...' })

    const trailId = await repos.trails.createTrail(trailName)

    for (let i = 0; i < sorted.length; i++) {
      const file = sorted[i]
      setProgress({ status: 'parsing', current: i + 1, total: sorted.length, message: `Parsing ${file.name}` })

      const parser = parsers.find((p) => p.canParse(file.name))
      if (!parser) continue

      const buffer = await file.arrayBuffer()
      const activities = await parser.parse(buffer, file.name)

      setProgress({ status: 'saving', current: i + 1, total: sorted.length, message: `Saving ${file.name}` })

      const dayId = await repos.trailDays.createTrailDay(trailId, file.name.replace(/\.(gpx|fit)$/i, ''), i + 1)

      for (let j = 0; j < activities.length; j++) {
        const activity = activities[j]
        const stats = computeStats(activity.points)
        const activityId = await repos.activities.createActivity(
          dayId, activity.name, activity.sourceFormat, stats, j + 1
        )
        await repos.trackpoints.insertTrackpoints(activityId, activity.points)
      }
    }

    setProgress({ status: 'done', current: sorted.length, total: sorted.length, message: 'Done!' })
    navigate({ to: '/trail/$trailId', params: { trailId } })
  }

  return { importFiles, progress }
}
```

**Step 3: Update home page with drop zone and import**

`apps/web/src/routes/index.tsx`:
```tsx
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { FileDropZone } from '../ui/components/file-drop-zone.js'
import { useImport } from '../application/hooks/use-import.js'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const { importFiles, progress } = useImport()
  const [files, setFiles] = useState<File[]>([])
  const [trailName, setTrailName] = useState('')

  const handleFiles = (newFiles: File[]) => {
    setFiles(newFiles)
    if (!trailName) {
      const prefix = newFiles[0]?.name.replace(/[_\s]\d+.*$/, '') ?? 'My Trail'
      setTrailName(prefix)
    }
  }

  const handleImport = () => {
    if (files.length === 0 || !trailName) return
    importFiles(trailName, files)
  }

  const isImporting = progress.status === 'parsing' || progress.status === 'saving'

  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-full max-w-lg flex flex-col gap-6 p-8">
        <FileDropZone onFiles={handleFiles} disabled={isImporting} />

        {files.length > 0 && (
          <div className="flex flex-col gap-4">
            <input
              type="text"
              value={trailName}
              onChange={(e) => setTrailName(e.target.value)}
              placeholder="Trail name"
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100"
            />
            <p className="text-sm text-gray-400">{files.length} file(s) selected</p>
            <button
              onClick={handleImport}
              disabled={isImporting}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 rounded-lg font-medium transition-colors"
            >
              {isImporting ? `${progress.message} (${progress.current}/${progress.total})` : 'Import'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 4: Verify import flow in browser**

Run: `pnpm --filter @traildiary/web dev`
Expected: Drop sample files from `_data/tracks/`, enter trail name, click Import, get redirected to `/trail/:id`.

**Step 5: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): add file drop zone and import flow"
```

---

## Task 11: Trail Page — Map View (apps/web)

**Files:**
- Create: `apps/web/src/application/hooks/use-trail.ts`
- Create: `apps/web/src/ui/components/map-view.tsx`
- Create: `apps/web/src/ui/components/day-sidebar.tsx`
- Modify: `apps/web/src/routes/trail.$trailId.tsx`

**Step 1: Create use-trail hook**

`apps/web/src/application/hooks/use-trail.ts`:
```tsx
import { useEffect, useState } from 'react'
import { simplifyTrack, aggregateStats, type TrackPoint, type TrackStats } from '@traildiary/core'
import { useDb } from '../providers/db-provider.js'
import { createRepositories } from '../../infrastructure/di.js'

export interface TrailDayView {
  id: string
  name: string
  dayNumber: number
  activities: Array<{
    id: string
    name: string
    stats: TrackStats
    simplifiedPoints: TrackPoint[]
  }>
  stats: TrackStats
}

export interface TrailView {
  id: string
  name: string
  days: TrailDayView[]
  stats: TrackStats
}

export function useTrail(trailId: string) {
  const db = useDb()
  const [trail, setTrail] = useState<TrailView | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const repos = createRepositories(db)
      const trailData = await repos.trails.getTrail(trailId)
      if (!trailData || cancelled) return

      const trailDays = await repos.trailDays.getTrailDays(trailId)
      const days: TrailDayView[] = []

      for (const day of trailDays) {
        const activities = await repos.activities.getActivities(day.id)
        const activityViews = []

        for (const act of activities) {
          const points = await repos.trackpoints.getTrackpointsSampled(act.id, 5)
          const simplified = simplifyTrack(points, 0.0001)
          activityViews.push({
            id: act.id,
            name: act.name,
            stats: act.stats,
            simplifiedPoints: simplified,
          })
        }

        days.push({
          id: day.id,
          name: day.name,
          dayNumber: day.dayNumber,
          activities: activityViews,
          stats: aggregateStats(activityViews.map((a) => a.stats)),
        })
      }

      if (!cancelled) {
        setTrail({
          id: trailId,
          name: trailData.name,
          days,
          stats: aggregateStats(days.map((d) => d.stats)),
        })
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [trailId, db])

  return { trail, loading }
}
```

**Step 2: Create map view component**

`apps/web/src/ui/components/map-view.tsx`:
```tsx
import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import type { TrailDayView } from '../../application/hooks/use-trail.js'

interface MapViewProps {
  days: TrailDayView[]
  selectedDayId: string | null
}

const DAY_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6',
]

export function MapView({ days, selectedDayId }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [0, 0],
      zoom: 2,
    })

    map.addControl(new maplibregl.NavigationControl())
    mapRef.current = map

    return () => map.remove()
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || days.length === 0) return

    function addLayers() {
      const bounds = new maplibregl.LngLatBounds()

      days.forEach((day, i) => {
        const sourceId = `day-${day.id}`
        const layerId = `day-line-${day.id}`
        const color = DAY_COLORS[i % DAY_COLORS.length]

        const coords = day.activities.flatMap((a) =>
          a.simplifiedPoints.map((p) => [p.lon, p.lat] as [number, number])
        )

        if (coords.length === 0) return
        coords.forEach((c) => bounds.extend(c))

        if (map.getSource(sourceId)) {
          (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData({
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: coords },
          })
        } else {
          map.addSource(sourceId, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: coords },
            },
          })

          map.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            paint: {
              'line-color': color,
              'line-width': selectedDayId === null || selectedDayId === day.id ? 3 : 1,
              'line-opacity': selectedDayId === null || selectedDayId === day.id ? 1 : 0.3,
            },
          })
        }
      })

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 50 })
      }
    }

    if (map.isStyleLoaded()) {
      addLayers()
    } else {
      map.on('load', addLayers)
    }
  }, [days, selectedDayId])

  return <div ref={containerRef} className="w-full h-full" />
}
```

**Step 3: Create day sidebar**

`apps/web/src/ui/components/day-sidebar.tsx`:
```tsx
import type { TrailView } from '../../application/hooks/use-trail.js'

interface DaySidebarProps {
  trail: TrailView
  selectedDayId: string | null
  onSelectDay: (dayId: string | null) => void
}

function formatDistance(km: number): string {
  return `${km.toFixed(1)} km`
}

function formatElevation(m: number): string {
  return `${Math.round(m)} m`
}

export function DaySidebar({ trail, selectedDayId, onSelectDay }: DaySidebarProps) {
  return (
    <div className="w-64 h-full overflow-y-auto border-r border-gray-800 flex flex-col">
      <button
        onClick={() => onSelectDay(null)}
        className={`p-3 text-left border-b border-gray-800 transition-colors ${
          selectedDayId === null ? 'bg-gray-800' : 'hover:bg-gray-900'
        }`}
      >
        <div className="font-medium">Trail total</div>
        <div className="text-sm text-gray-400">
          {formatDistance(trail.stats.distance)} | +{formatElevation(trail.stats.elevationGain)}
        </div>
      </button>

      {trail.days.map((day) => (
        <button
          key={day.id}
          onClick={() => onSelectDay(day.id)}
          className={`p-3 text-left border-b border-gray-800 transition-colors ${
            selectedDayId === day.id ? 'bg-gray-800' : 'hover:bg-gray-900'
          }`}
        >
          <div className="font-medium text-sm">{day.name}</div>
          <div className="text-xs text-gray-400">
            {formatDistance(day.stats.distance)} | +{formatElevation(day.stats.elevationGain)}
          </div>
        </button>
      ))}
    </div>
  )
}
```

**Step 4: Wire up trail page**

`apps/web/src/routes/trail.$trailId.tsx`:
```tsx
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useTrail } from '../application/hooks/use-trail.js'
import { MapView } from '../ui/components/map-view.js'
import { DaySidebar } from '../ui/components/day-sidebar.js'

export const Route = createFileRoute('/trail/$trailId')({
  component: TrailPage,
})

function TrailPage() {
  const { trailId } = Route.useParams()
  const { trail, loading } = useTrail(trailId)
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null)

  if (loading || !trail) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400">Loading trail...</p>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <DaySidebar trail={trail} selectedDayId={selectedDayId} onSelectDay={setSelectedDayId} />
      <div className="flex-1 flex flex-col">
        <div className="flex-1">
          <MapView days={trail.days} selectedDayId={selectedDayId} />
        </div>
      </div>
    </div>
  )
}
```

**Step 5: Verify in browser**

Run: `pnpm --filter @traildiary/web dev`
Expected: Import sample files → navigate to trail page → see colored track lines on map with day sidebar.

**Step 6: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): add trail page with map view and day sidebar"
```

---

## Task 12: Elevation Chart & Stats Panel (apps/web)

**Files:**
- Create: `apps/web/src/application/hooks/use-activity.ts`
- Create: `apps/web/src/ui/components/elevation-chart.tsx`
- Create: `apps/web/src/ui/components/stats-panel.tsx`
- Modify: `apps/web/src/routes/trail.$trailId.tsx`

**Step 1: Create use-activity hook for loading full trackpoints on demand**

`apps/web/src/application/hooks/use-activity.ts`:
```tsx
import { useEffect, useState } from 'react'
import { downsampleForChart, type TrackPoint } from '@traildiary/core'
import { useDb } from '../providers/db-provider.js'
import { createRepositories } from '../../infrastructure/di.js'
import type { TrailView } from './use-trail.js'

export function useElevationData(trail: TrailView | null, selectedDayId: string | null) {
  const db = useDb()
  const [chartPoints, setChartPoints] = useState<TrackPoint[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!trail) return
    let cancelled = false
    setLoading(true)

    async function load() {
      const repos = createRepositories(db)
      const allPoints: TrackPoint[] = []

      const days = selectedDayId
        ? trail!.days.filter((d) => d.id === selectedDayId)
        : trail!.days

      for (const day of days) {
        for (const act of day.activities) {
          const points = await repos.trackpoints.getTrackpointsSampled(act.id, 3)
          allPoints.push(...points)
        }
      }

      if (!cancelled) {
        setChartPoints(downsampleForChart(allPoints, 2000))
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [trail, selectedDayId, db])

  return { chartPoints, loading }
}
```

**Step 2: Create elevation chart**

`apps/web/src/ui/components/elevation-chart.tsx`:
```tsx
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { haversineDistance, type TrackPoint } from '@traildiary/core'

interface ElevationChartProps {
  points: TrackPoint[]
}

interface ChartDataPoint {
  distance: number
  elevation: number
}

function buildChartData(points: TrackPoint[]): ChartDataPoint[] {
  if (points.length === 0) return []

  let cumDistance = 0
  const data: ChartDataPoint[] = [{ distance: 0, elevation: points[0].elevation }]

  for (let i = 1; i < points.length; i++) {
    cumDistance += haversineDistance(points[i - 1], points[i])
    data.push({ distance: Math.round(cumDistance * 10) / 10, elevation: Math.round(points[i].elevation) })
  }

  return data
}

export function ElevationChart({ points }: ElevationChartProps) {
  const data = buildChartData(points)

  if (data.length === 0) {
    return <div className="h-full flex items-center justify-center text-gray-500">No elevation data</div>
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
        <defs>
          <linearGradient id="elevGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="distance"
          stroke="#6b7280"
          fontSize={12}
          tickFormatter={(v) => `${v} km`}
        />
        <YAxis
          stroke="#6b7280"
          fontSize={12}
          tickFormatter={(v) => `${v} m`}
        />
        <Tooltip
          contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
          labelFormatter={(v) => `${v} km`}
          formatter={(v: number) => [`${v} m`, 'Elevation']}
        />
        <Area
          type="monotone"
          dataKey="elevation"
          stroke="#3b82f6"
          fill="url(#elevGradient)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
```

**Step 3: Create stats panel**

`apps/web/src/ui/components/stats-panel.tsx`:
```tsx
import type { TrackStats } from '@traildiary/core'

interface StatsPanelProps {
  stats: TrackStats
  label: string
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3_600_000)
  const minutes = Math.floor((ms % 3_600_000) / 60_000)
  return `${hours}h ${minutes}m`
}

export function StatsPanel({ stats, label }: StatsPanelProps) {
  return (
    <div className="flex items-center gap-6 px-4 py-2 text-sm">
      <span className="font-medium text-gray-300">{label}</span>
      <span className="text-gray-400">
        {stats.distance.toFixed(1)} km
      </span>
      <span className="text-green-400">
        +{Math.round(stats.elevationGain)} m
      </span>
      <span className="text-red-400">
        -{Math.round(stats.elevationLoss)} m
      </span>
      <span className="text-gray-400">
        {formatDuration(stats.duration)}
      </span>
      <span className="text-gray-400">
        Moving: {formatDuration(stats.movingTime)}
      </span>
      <span className="text-gray-400">
        {stats.avgSpeed.toFixed(1)} km/h avg
      </span>
    </div>
  )
}
```

**Step 4: Update trail page to include chart and stats**

`apps/web/src/routes/trail.$trailId.tsx`:
```tsx
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useTrail } from '../application/hooks/use-trail.js'
import { useElevationData } from '../application/hooks/use-activity.js'
import { MapView } from '../ui/components/map-view.js'
import { DaySidebar } from '../ui/components/day-sidebar.js'
import { ElevationChart } from '../ui/components/elevation-chart.js'
import { StatsPanel } from '../ui/components/stats-panel.js'

export const Route = createFileRoute('/trail/$trailId')({
  component: TrailPage,
})

function TrailPage() {
  const { trailId } = Route.useParams()
  const { trail, loading } = useTrail(trailId)
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null)
  const { chartPoints } = useElevationData(trail, selectedDayId)

  if (loading || !trail) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400">Loading trail...</p>
      </div>
    )
  }

  const selectedDay = selectedDayId ? trail.days.find((d) => d.id === selectedDayId) : null
  const currentStats = selectedDay ? selectedDay.stats : trail.stats
  const currentLabel = selectedDay ? selectedDay.name : 'Trail total'

  return (
    <div className="flex h-full">
      <DaySidebar trail={trail} selectedDayId={selectedDayId} onSelectDay={setSelectedDayId} />
      <div className="flex-1 flex flex-col">
        <div className="flex-1">
          <MapView days={trail.days} selectedDayId={selectedDayId} />
        </div>
        <div className="h-48 border-t border-gray-800">
          <ElevationChart points={chartPoints} />
        </div>
        <div className="border-t border-gray-800">
          <StatsPanel stats={currentStats} label={currentLabel} />
        </div>
      </div>
    </div>
  )
}
```

**Step 5: Verify full flow in browser**

Run: `pnpm --filter @traildiary/web dev`
Expected: Import TMB files → trail page shows map with colored tracks, elevation chart below, stats at bottom. Click days in sidebar → chart and stats update.

**Step 6: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): add elevation chart and stats panel to trail page"
```

---

## Task 13: End-to-End Smoke Test with Sample Data

**Files:**
- Create: `apps/web/e2e/smoke.test.ts` (optional — manual verification is sufficient for PoC)

**Step 1: Manual verification checklist**

Run: `pnpm --filter @traildiary/web dev`

Verify these scenarios:
1. **Home page** loads with drop zone
2. **Drop TMB FIT files** (7 files) → progress shown → redirects to trail page
3. **Map** shows 7 colored track lines in the Alps region
4. **Sidebar** shows 7 days with distance/elevation for each
5. **Click a day** → that track highlights, others fade, chart/stats update
6. **Click "Trail total"** → all tracks shown, combined chart/stats
7. **Refresh browser** → navigate back to trail → data persists from PGlite
8. **Drop PCT files** (4 files) as a second trail → both trails work independently

**Step 2: Run all unit tests**

Run: `pnpm test`
Expected: All tests PASS across core and db packages.

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: PoC complete — GPX/FIT parsing, map visualization, offline persistence"
```

---

## Summary

| Task | Package | What |
|------|---------|------|
| 1 | root | Monorepo scaffolding |
| 2 | core | Domain model (entities, stats) |
| 3 | core | Track simplifier + downsampler |
| 4 | core | GPX parser |
| 5 | core | FIT parser |
| 6 | core | Public API exports |
| 7 | db | PGlite + repositories |
| 8 | web | App shell (Vite, Router, Tailwind) |
| 9 | web | PGlite provider + DI |
| 10 | web | File drop zone + import flow |
| 11 | web | Trail page + map + sidebar |
| 12 | web | Elevation chart + stats panel |
| 13 | all | Smoke test + verification |
