# Mobile React Native Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a React Native mobile app (apps/mobile) that reuses domain/application logic from the web app via shared packages, following DDD + Hexagonal Architecture with ports for all platform-specific features.

**Architecture:** Hexagonal/Ports-and-Adapters — `packages/core` owns the domain + application services (pure TS, zero React); `packages/ui` owns shared React hooks using repository ports; `apps/web` and `apps/mobile` each supply their own infrastructure adapters (DB, file I/O, navigation, map, chart). Nothing in packages/ depends on React Native or browser APIs.

**Tech Stack:**
- React Native via **Expo SDK 52** + **Expo Router** (file-based nav, mirrors TanStack Router on web)
- **expo-sqlite** — embedded SQLite (port adapter for TrailRepository, replaces PGlite on mobile)
- **expo-document-picker** + **expo-file-system** — file picking port for mobile
- **@maplibre/maplibre-react-native** — map port for mobile (same vector tiles as web)
- **victory-native** — elevation chart port for mobile
- **NativeWind v4** — Tailwind CSS utility styling for React Native
- **fast-xml-parser** — pure-JS XML parser (replaces DOMParser in GpxParser, works in all envs)
- **Vitest** — unit tests for packages/; **Jest + jest-expo** — component/integration tests for mobile

---

## Hexagonal Boundary Map

```
packages/core/domain/         ← Pure domain types + algorithms (no deps)
packages/core/application/    ← Port interfaces + application services (no React, no infra)
packages/ui/                  ← Shared React hooks (use port interfaces from core)
                                 NO browser APIs, NO React Native APIs

apps/web/infrastructure/      ← PGlite adapter, DOMParser adapter, file-read adapter
apps/web/ui/                  ← MapLibre GL, Recharts, FileDropZone (HTML)

apps/mobile/infrastructure/   ← expo-sqlite adapter, expo-file-system adapter
apps/mobile/ui/               ← MapLibre RN, victory-native, DocumentPicker (RN)
```

Ports defined in `packages/core/application/ports.ts` and `repositories.ts`:
- `FileParser` — parse binary file data into activities (already defined)
- `TrailRepository`, `TrailDayRepository`, `ActivityRepository`, `TrackpointRepository` — DB access (already defined)

New port to add: none — file I/O differences are handled at the hook call-site (caller converts platform file handles to `ArrayBuffer` before calling shared hooks).

---

## Phase 1 — Fix GpxParser for React Native

The current `GpxParser` uses `DOMParser` (browser-only) with a jsdom fallback for Node tests. React Native's Hermes engine has neither. Replace with `fast-xml-parser` (pure JS, zero native deps).

### Task 1: Replace DOMParser with fast-xml-parser in GpxParser

**Files:**
- Modify: `packages/core/src/infrastructure/gpx-parser.ts`
- Modify: `packages/core/package.json` (add fast-xml-parser, remove jsdom)
- Test: `packages/core/src/__tests__/infrastructure/gpx-parser.test.ts` (already exists or create it)

**Step 1: Write/confirm the failing test exists for gpx-parser**

Check `packages/core/src/__tests__/` for existing gpx-parser tests. If none exist, create:

```typescript
// packages/core/src/__tests__/infrastructure/gpx-parser.test.ts
import { describe, it, expect } from 'vitest'
import { GpxParser } from '../../infrastructure/gpx-parser.js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const parser = new GpxParser()

describe('GpxParser', () => {
  it('parses a gpx file into activities with trackpoints', async () => {
    const buf = readFileSync(join(__dirname, '../../../../_data/sample.gpx'))
    const activities = await parser.parse(buf.buffer, 'sample.gpx')
    expect(activities.length).toBeGreaterThan(0)
    expect(activities[0].points.length).toBeGreaterThan(0)
    expect(activities[0].sourceFormat).toBe('gpx')
  })

  it('returns empty array for gpx with no tracks', async () => {
    const xml = `<?xml version="1.0"?><gpx version="1.1"></gpx>`
    const buf = new TextEncoder().encode(xml).buffer
    const activities = await parser.parse(buf, 'empty.gpx')
    expect(activities).toEqual([])
  })
})
```

**Step 2: Run existing tests to verify current state**

```bash
pnpm --filter @traildiary/core test
```

**Step 3: Install fast-xml-parser and remove jsdom**

In `packages/core/package.json`:
- Add to `dependencies`: `"fast-xml-parser": "^4.5.0"`
- Remove `jsdom` from `devDependencies`

```bash
cd packages/core && pnpm add fast-xml-parser && pnpm remove jsdom
```

**Step 4: Rewrite GpxParser using fast-xml-parser**

```typescript
// packages/core/src/infrastructure/gpx-parser.ts
import { XMLParser } from 'fast-xml-parser'
import type { FileParser, ParsedActivity } from '../application/ports.js'
import { calcDistance } from '../domain/distance.js'
import { latLngFromPoint } from '../domain/latlng.js'
import type { TrackPoint } from '../domain/trackpoint.js'

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => ['trk', 'trkseg', 'trkpt'].includes(name),
})

export class GpxParser implements FileParser {
  canParse(fileName: string): boolean {
    return fileName.toLowerCase().endsWith('.gpx')
  }

  async parse(data: ArrayBuffer, fileName: string): Promise<ParsedActivity[]> {
    const text = new TextDecoder().decode(data)
    const result = xmlParser.parse(text)
    const tracks: unknown[] = result?.gpx?.trk ?? []
    const activities: ParsedActivity[] = []

    for (const track of tracks as Record<string, unknown>[]) {
      const name = (track.name as string | undefined) ?? fileName.replace(/\.gpx$/i, '')
      const rawPoints: unknown[] = []

      const segs = track.trkseg as Record<string, unknown>[] | undefined
      if (segs) {
        for (const seg of segs) {
          const pts = seg.trkpt as unknown[] | undefined
          if (pts) rawPoints.push(...pts)
        }
      }

      if (rawPoints.length === 0) continue

      const points: TrackPoint[] = []
      let prevPoint = parseTrkpt(rawPoints[0] as Record<string, unknown>)

      for (let i = 1; i < rawPoints.length; i++) {
        const pt = parseTrkpt(rawPoints[i] as Record<string, unknown>)
        const distance = calcDistance(latLngFromPoint(prevPoint), latLngFromPoint(pt))
        points.push({ ...pt, distance, index: i })
        prevPoint = pt
      }

      activities.push({ name, sourceFormat: 'gpx', points })
    }

    return activities
  }
}

function parseTrkpt(pt: Record<string, unknown>): Omit<TrackPoint, 'distance' | 'index'> {
  const lat = parseFloat(String(pt['@_lat'] ?? '0'))
  const lon = parseFloat(String(pt['@_lon'] ?? '0'))
  const elevation = pt.ele !== undefined ? parseFloat(String(pt.ele)) : 0
  const timestamp = pt.time ? new Date(String(pt.time)).getTime() : 0
  return { lat, lon, elevation, timestamp }
}
```

**Step 5: Run tests to verify they pass**

```bash
pnpm --filter @traildiary/core test
```

Expected: all tests PASS (same results as before, different XML parsing library)

**Step 6: Commit**

```bash
git add packages/core/src/infrastructure/gpx-parser.ts packages/core/package.json
git commit -m "refactor: replace DOMParser with fast-xml-parser in GpxParser (RN compatible)"
```

---

## Phase 2 — Create packages/ui (Shared React Hooks)

`packages/ui` contains React hooks that call the application layer through repository port interfaces. These hooks work identically on web and mobile — only the `RepositoryProvider` wrapper (which injects concrete repositories) differs per platform.

### Task 2: Initialize packages/ui

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/src/index.ts`

**Step 1: Create package.json**

```json
// packages/ui/package.json
{
  "name": "@traildiary/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "peerDependencies": {
    "react": ">=18"
  },
  "dependencies": {
    "@traildiary/core": "workspace:*"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
// packages/ui/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

**Step 3: Create empty index**

```typescript
// packages/ui/src/index.ts
// Exports added in subsequent tasks
export {}
```

**Step 4: Install dependencies**

```bash
pnpm install
```

**Step 5: Commit**

```bash
git add packages/ui/
git commit -m "feat: initialize packages/ui for shared React hooks"
```

---

### Task 3: Create RepositoryContext in packages/ui

This context is the bridge between platform-specific infrastructure and platform-agnostic hooks. Each app wraps its tree with `RepositoryProvider` supplying concrete adapters.

**Files:**
- Create: `packages/ui/src/contexts/repository-context.tsx`
- Modify: `packages/ui/src/index.ts`

**Step 1: Write the failing test**

```typescript
// packages/ui/src/__tests__/contexts/repository-context.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { RepositoryProvider, useRepositories } from '../../contexts/repository-context.js'
import type { Repositories } from '../../contexts/repository-context.js'

const mockRepos: Repositories = {
  trails: { createTrail: vi.fn(), getTrail: vi.fn(), listTrails: vi.fn(), listTrailSummaries: vi.fn(), deleteTrail: vi.fn() },
  trailDays: { createTrailDay: vi.fn(), getTrailDays: vi.fn(), deleteTrailDay: vi.fn() },
  activities: { createActivity: vi.fn(), getActivities: vi.fn(), deleteActivity: vi.fn() },
  trackpoints: { insertTrackpoints: vi.fn(), getTrackpoints: vi.fn(), getTrackpointsSampled: vi.fn(), recalculatePointIndices: vi.fn() },
}

describe('RepositoryContext', () => {
  it('provides repositories via useRepositories', () => {
    const { result } = renderHook(() => useRepositories(), {
      wrapper: ({ children }) => (
        <RepositoryProvider repositories={mockRepos}>{children}</RepositoryProvider>
      ),
    })
    expect(result.current.trails).toBe(mockRepos.trails)
  })

  it('throws when used outside RepositoryProvider', () => {
    expect(() =>
      renderHook(() => useRepositories())
    ).toThrow('useRepositories must be used within RepositoryProvider')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter @traildiary/ui test
```

Expected: FAIL — module not found

**Step 3: Implement RepositoryContext**

```typescript
// packages/ui/src/contexts/repository-context.tsx
import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type {
  TrailRepository,
  TrailDayRepository,
  ActivityRepository,
  TrackpointRepository,
} from '@traildiary/core'

export interface Repositories {
  trails: TrailRepository
  trailDays: TrailDayRepository
  activities: ActivityRepository
  trackpoints: TrackpointRepository
}

const RepositoryContext = createContext<Repositories | null>(null)

export function RepositoryProvider({
  children,
  repositories,
}: {
  children: ReactNode
  repositories: Repositories
}) {
  return (
    <RepositoryContext.Provider value={repositories}>
      {children}
    </RepositoryContext.Provider>
  )
}

export function useRepositories(): Repositories {
  const ctx = useContext(RepositoryContext)
  if (!ctx) throw new Error('useRepositories must be used within RepositoryProvider')
  return ctx
}
```

**Step 4: Add vitest config + @testing-library/react to packages/ui**

```json
// Add to packages/ui/package.json devDependencies:
"@testing-library/react": "^16.0.0",
"@vitejs/plugin-react": "^4.0.0",
"jsdom": "^25.0.0"
```

Create `packages/ui/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: { environment: 'jsdom' },
})
```

**Step 5: Run tests to verify they pass**

```bash
pnpm --filter @traildiary/ui test
```

**Step 6: Export from index.ts**

```typescript
// packages/ui/src/index.ts
export { RepositoryProvider, useRepositories } from './contexts/repository-context.js'
export type { Repositories } from './contexts/repository-context.js'
```

**Step 7: Commit**

```bash
git add packages/ui/
git commit -m "feat: add RepositoryContext to packages/ui — hexagonal DI bridge"
```

---

### Task 4: Create shared hook useTrails

**Files:**
- Create: `packages/ui/src/hooks/use-trails.ts`
- Create: `packages/ui/src/__tests__/hooks/use-trails.test.tsx`
- Modify: `packages/ui/src/index.ts`

**Step 1: Write the failing test**

```typescript
// packages/ui/src/__tests__/hooks/use-trails.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { RepositoryProvider } from '../../contexts/repository-context.js'
import { useTrails } from '../../hooks/use-trails.js'
import type { Repositories } from '../../contexts/repository-context.js'
import type { TrailSummaryDto } from '@traildiary/core'

const summaries: TrailSummaryDto[] = [
  { id: '1', name: 'Trail A', totalDistanceKm: 10, startDate: '2024-01-01', endDate: '2024-01-03', dayCount: 3 },
]

function makeRepos(overrides: Partial<Repositories['trails']> = {}): Repositories {
  return {
    trails: { createTrail: vi.fn(), getTrail: vi.fn(), listTrails: vi.fn(), listTrailSummaries: vi.fn().mockResolvedValue(summaries), deleteTrail: vi.fn().mockResolvedValue(undefined), ...overrides },
    trailDays: { createTrailDay: vi.fn(), getTrailDays: vi.fn(), deleteTrailDay: vi.fn() },
    activities: { createActivity: vi.fn(), getActivities: vi.fn(), deleteActivity: vi.fn() },
    trackpoints: { insertTrackpoints: vi.fn(), getTrackpoints: vi.fn(), getTrackpointsSampled: vi.fn(), recalculatePointIndices: vi.fn() },
  }
}

describe('useTrails', () => {
  it('loads trail summaries on mount', async () => {
    const repos = makeRepos()
    const { result } = renderHook(() => useTrails(), {
      wrapper: ({ children }) => <RepositoryProvider repositories={repos}>{children}</RepositoryProvider>,
    })
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.trails).toEqual(summaries)
  })

  it('deleteTrail removes trail from list', async () => {
    const repos = makeRepos()
    const { result } = renderHook(() => useTrails(), {
      wrapper: ({ children }) => <RepositoryProvider repositories={repos}>{children}</RepositoryProvider>,
    })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.deleteTrail('1') })
    expect(result.current.trails).toHaveLength(0)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter @traildiary/ui test
```

**Step 3: Implement useTrails**

```typescript
// packages/ui/src/hooks/use-trails.ts
import { useEffect, useState } from 'react'
import type { TrailSummaryDto } from '@traildiary/core'
import { useRepositories } from '../contexts/repository-context.js'

export function useTrails() {
  const repos = useRepositories()
  const [trails, setTrails] = useState<TrailSummaryDto[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    repos.trails.listTrailSummaries().then((summaries) => {
      if (!cancelled) {
        setTrails(summaries)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [repos])

  async function deleteTrail(id: string) {
    await repos.trails.deleteTrail(id)
    setTrails((prev) => prev.filter((t) => t.id !== id))
  }

  return { trails, loading, deleteTrail }
}
```

**Step 4: Run tests to verify they pass**

```bash
pnpm --filter @traildiary/ui test
```

**Step 5: Export from index.ts**

```typescript
export { useTrails } from './hooks/use-trails.js'
```

**Step 6: Commit**

```bash
git add packages/ui/src/hooks/use-trails.ts packages/ui/src/__tests__/hooks/use-trails.test.tsx packages/ui/src/index.ts
git commit -m "feat: add shared useTrails hook to packages/ui"
```

---

### Task 5: Create shared hook useTrail + view types

**Files:**
- Create: `packages/ui/src/hooks/use-trail.ts`
- Create: `packages/ui/src/types/trail-view.ts`
- Create: `packages/ui/src/__tests__/hooks/use-trail.test.tsx`

**Step 1: Write the failing test**

```typescript
// packages/ui/src/__tests__/hooks/use-trail.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { RepositoryProvider } from '../../contexts/repository-context.js'
import { useTrail } from '../../hooks/use-trail.js'
import type { TrackPoint } from '@traildiary/core'

const mockPoint: TrackPoint = { lat: 47, lon: 13, elevation: 1000, timestamp: 1_000_000, index: 0, distance: 0 }

function makeRepos() {
  return {
    trails: { createTrail: vi.fn(), getTrail: vi.fn().mockResolvedValue({ id: 't1', name: 'Alps' }), listTrails: vi.fn(), listTrailSummaries: vi.fn(), deleteTrail: vi.fn() },
    trailDays: { createTrailDay: vi.fn(), getTrailDays: vi.fn().mockResolvedValue([{ id: 'd1', name: 'Day 1', dayNumber: 1 }]), deleteTrailDay: vi.fn() },
    activities: { createActivity: vi.fn(), getActivities: vi.fn().mockResolvedValue([{ id: 'a1', name: 'Morning run', sourceFormat: 'gpx', stats: { distance: 5, elevationGain: 200, elevationLoss: 200, duration: 3600000, movingTime: 3500000, avgSpeed: 5, startTime: 1_000_000, endTime: 1_003_600_000 } }]), deleteActivity: vi.fn() },
    trackpoints: { insertTrackpoints: vi.fn(), getTrackpoints: vi.fn(), getTrackpointsSampled: vi.fn().mockResolvedValue([mockPoint, mockPoint, mockPoint]), recalculatePointIndices: vi.fn() },
  }
}

describe('useTrail', () => {
  it('loads trail with days and activities', async () => {
    const repos = makeRepos()
    const { result } = renderHook(() => useTrail('t1'), {
      wrapper: ({ children }) => <RepositoryProvider repositories={repos as any}>{children}</RepositoryProvider>,
    })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.trail?.name).toBe('Alps')
    expect(result.current.trail?.days).toHaveLength(1)
    expect(result.current.trail?.days[0].activities).toHaveLength(1)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter @traildiary/ui test
```

**Step 3: Create view types**

```typescript
// packages/ui/src/types/trail-view.ts
import type { TrackPoint, TrackStats } from '@traildiary/core'

export interface ActivityView {
  id: string
  name: string
  stats: TrackStats
  simplifiedPoints: TrackPoint[]
}

export interface TrailDayView {
  id: string
  name: string
  dayNumber: number
  activities: ActivityView[]
  stats: TrackStats
}

export interface TrailView {
  id: string
  name: string
  days: TrailDayView[]
  stats: TrackStats
}
```

**Step 4: Implement useTrail**

```typescript
// packages/ui/src/hooks/use-trail.ts
import { useCallback, useEffect, useState } from 'react'
import { simplifyTrack, aggregateStats } from '@traildiary/core'
import { useRepositories } from '../contexts/repository-context.js'
import type { TrailView, TrailDayView } from '../types/trail-view.js'

export function useTrail(trailId: string) {
  const repos = useRepositories()
  const [trail, setTrail] = useState<TrailView | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      const trailData = await repos.trails.getTrail(trailId)
      if (!trailData || cancelled) return

      const trailDays = await repos.trailDays.getTrailDays(trailId)
      const days: TrailDayView[] = []

      for (const day of trailDays) {
        const activities = await repos.activities.getActivities(day.id)
        const activityViews = await Promise.all(
          activities.map(async (act) => {
            const points = await repos.trackpoints.getTrackpointsSampled(act.id, 5)
            return {
              id: act.id,
              name: act.name,
              stats: act.stats,
              simplifiedPoints: simplifyTrack(points, 0.0001),
            }
          })
        )
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
  }, [trailId, repos, refreshKey])

  return { trail, loading, refresh }
}
```

**Step 5: Run tests to verify they pass + export from index**

```bash
pnpm --filter @traildiary/ui test
```

Add to `packages/ui/src/index.ts`:
```typescript
export { useTrail } from './hooks/use-trail.js'
export type { TrailView, TrailDayView, ActivityView } from './types/trail-view.js'
```

**Step 6: Commit**

```bash
git add packages/ui/src/
git commit -m "feat: add shared useTrail hook + TrailView types to packages/ui"
```

---

### Task 6: Create shared useImport and useAddActivity hooks

These hooks accept `Array<{ name: string; data: ArrayBuffer }>` instead of `File[]`. The caller (web or mobile) reads the file data before calling. Navigation is not done inside these hooks — the caller gets back `trailId` and navigates on its own.

**Files:**
- Create: `packages/ui/src/hooks/use-import.ts`
- Create: `packages/ui/src/hooks/use-add-activity.ts`
- Create: `packages/ui/src/__tests__/hooks/use-import.test.tsx`

**Step 1: Write failing test for useImport**

```typescript
// packages/ui/src/__tests__/hooks/use-import.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { RepositoryProvider } from '../../contexts/repository-context.js'
import { useImport } from '../../hooks/use-import.js'
import { GpxParser } from '@traildiary/core'

// Minimal GPX for testing
const gpxXml = `<?xml version="1.0"?><gpx version="1.1"><trk><name>Test</name><trkseg>
  <trkpt lat="47.0" lon="13.0"><ele>1000</ele><time>2024-01-01T08:00:00Z</time></trkpt>
  <trkpt lat="47.1" lon="13.1"><ele>1100</ele><time>2024-01-01T09:00:00Z</time></trkpt>
</trkseg></trk></gpx>`

function makeRepos() {
  const trailId = 'new-trail-id'
  return {
    trails: { createTrail: vi.fn().mockResolvedValue(trailId), getTrail: vi.fn(), listTrails: vi.fn(), listTrailSummaries: vi.fn(), deleteTrail: vi.fn() },
    trailDays: { createTrailDay: vi.fn().mockResolvedValue('day-1'), getTrailDays: vi.fn().mockResolvedValue([]), deleteTrailDay: vi.fn() },
    activities: { createActivity: vi.fn().mockResolvedValue('act-1'), getActivities: vi.fn(), deleteActivity: vi.fn() },
    trackpoints: { insertTrackpoints: vi.fn().mockResolvedValue(undefined), getTrackpoints: vi.fn(), getTrackpointsSampled: vi.fn(), recalculatePointIndices: vi.fn() },
  }
}

describe('useImport', () => {
  it('imports files and returns trailId when done', async () => {
    const repos = makeRepos()
    const parsers = [new GpxParser()]
    const { result } = renderHook(() => useImport(parsers), {
      wrapper: ({ children }) => <RepositoryProvider repositories={repos as any}>{children}</RepositoryProvider>,
    })

    const buf = new TextEncoder().encode(gpxXml).buffer
    let trailId: string | null = null

    await act(async () => {
      trailId = await result.current.importFiles('My Trail', [{ name: 'test.gpx', data: buf }])
    })

    expect(trailId).toBe('new-trail-id')
    expect(repos.trails.createTrail).toHaveBeenCalledWith('My Trail')
    expect(repos.trackpoints.insertTrackpoints).toHaveBeenCalled()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter @traildiary/ui test
```

**Step 3: Implement useImport**

```typescript
// packages/ui/src/hooks/use-import.ts
import { useState } from 'react'
import { computeStats, validateActivityTimestamps } from '@traildiary/core'
import type { FileParser } from '@traildiary/core'
import { useRepositories } from '../contexts/repository-context.js'

export interface FileData {
  name: string
  data: ArrayBuffer
}

export interface ImportProgress {
  status: 'idle' | 'parsing' | 'saving' | 'done' | 'error'
  current: number
  total: number
  message: string
}

export function useImport(parsers: FileParser[]) {
  const repos = useRepositories()
  const [progress, setProgress] = useState<ImportProgress>({
    status: 'idle', current: 0, total: 0, message: '',
  })

  async function importFiles(trailName: string, files: FileData[]): Promise<string | null> {
    const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name))
    setProgress({ status: 'parsing', current: 0, total: sorted.length, message: 'Starting...' })

    const trailId = await repos.trails.createTrail(trailName)

    for (let i = 0; i < sorted.length; i++) {
      const file = sorted[i]
      setProgress({ status: 'parsing', current: i + 1, total: sorted.length, message: `Parsing ${file.name}` })

      const parser = parsers.find((p) => p.canParse(file.name))
      if (!parser) continue

      const activities = await parser.parse(file.data, file.name)
      const validActivities = activities.filter((a) => validateActivityTimestamps(a.points))
      if (validActivities.length === 0) continue

      setProgress({ status: 'saving', current: i + 1, total: sorted.length, message: `Saving ${file.name}` })

      const dayId = await repos.trailDays.createTrailDay(
        trailId, file.name.replace(/\.(gpx|fit)$/i, ''), i + 1
      )

      for (let j = 0; j < validActivities.length; j++) {
        const activity = validActivities[j]
        const stats = computeStats(activity.points)
        const activityId = await repos.activities.createActivity(dayId, activity.name, activity.sourceFormat, stats, j + 1)
        await repos.trackpoints.insertTrackpoints(activityId, dayId, activity.points)
      }
    }

    setProgress({ status: 'done', current: sorted.length, total: sorted.length, message: 'Done!' })
    return trailId
  }

  return { importFiles, progress }
}
```

**Step 4: Implement useAddActivity** (same pattern, appends to existing trail)

```typescript
// packages/ui/src/hooks/use-add-activity.ts
import { useState } from 'react'
import { computeStats, validateActivityTimestamps } from '@traildiary/core'
import type { FileParser } from '@traildiary/core'
import { useRepositories } from '../contexts/repository-context.js'
import type { FileData, ImportProgress } from './use-import.js'

export function useAddActivity(trailId: string, parsers: FileParser[]) {
  const repos = useRepositories()
  const [progress, setProgress] = useState<ImportProgress>({
    status: 'idle', current: 0, total: 0, message: '',
  })

  async function addFiles(files: FileData[]): Promise<void> {
    const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name))
    setProgress({ status: 'parsing', current: 0, total: sorted.length, message: 'Starting...' })

    const existingDays = await repos.trailDays.getTrailDays(trailId)
    let nextDayNumber = existingDays.length > 0
      ? Math.max(...existingDays.map((d) => d.dayNumber)) + 1
      : 1

    for (let i = 0; i < sorted.length; i++) {
      const file = sorted[i]
      setProgress({ status: 'parsing', current: i + 1, total: sorted.length, message: `Parsing ${file.name}` })

      const parser = parsers.find((p) => p.canParse(file.name))
      if (!parser) continue

      const activities = await parser.parse(file.data, file.name)
      const validActivities = activities.filter((a) => validateActivityTimestamps(a.points))
      if (validActivities.length === 0) continue

      setProgress({ status: 'saving', current: i + 1, total: sorted.length, message: `Saving ${file.name}` })

      const dayId = await repos.trailDays.createTrailDay(
        trailId, file.name.replace(/\.(gpx|fit)$/i, ''), nextDayNumber++
      )

      for (let j = 0; j < validActivities.length; j++) {
        const activity = validActivities[j]
        const stats = computeStats(activity.points)
        const activityId = await repos.activities.createActivity(dayId, activity.name, activity.sourceFormat, stats, j + 1)
        await repos.trackpoints.insertTrackpoints(activityId, dayId, activity.points)
      }
    }

    setProgress({ status: 'done', current: sorted.length, total: sorted.length, message: 'Done!' })
  }

  return { addFiles, progress }
}
```

**Step 5: Run all packages/ui tests**

```bash
pnpm --filter @traildiary/ui test
```

**Step 6: Export from index.ts**

```typescript
export { useImport } from './hooks/use-import.js'
export { useAddActivity } from './hooks/use-add-activity.js'
export type { FileData, ImportProgress } from './hooks/use-import.js'
```

**Step 7: Commit**

```bash
git add packages/ui/src/
git commit -m "feat: add shared useImport and useAddActivity hooks to packages/ui"
```

---

### Task 7: Create shared useRemoveDay hook

**Files:**
- Create: `packages/ui/src/hooks/use-remove-day.ts`

```typescript
// packages/ui/src/hooks/use-remove-day.ts
import { useRepositories } from '../contexts/repository-context.js'

export function useRemoveDay() {
  const repos = useRepositories()

  async function removeDay(trailDayId: string): Promise<void> {
    await repos.trailDays.deleteTrailDay(trailDayId)
  }

  return { removeDay }
}
```

Export from index.ts:
```typescript
export { useRemoveDay } from './hooks/use-remove-day.js'
```

Commit:
```bash
git add packages/ui/src/hooks/use-remove-day.ts packages/ui/src/index.ts
git commit -m "feat: add shared useRemoveDay hook to packages/ui"
```

---

## Phase 3 — Update apps/web to Use packages/ui

### Task 8: Wire RepositoryProvider into web DbProvider

The web `DbProvider` currently provides only a PGlite instance. It needs to also provide `RepositoryProvider` so web hooks can be migrated to packages/ui.

**Files:**
- Modify: `apps/web/src/application/providers/db-provider.tsx`
- Modify: `apps/web/package.json` (add `@traildiary/ui` dependency)

**Step 1: Add @traildiary/ui to apps/web**

```bash
cd apps/web && pnpm add @traildiary/ui
```

**Step 2: Update DbProvider to also wrap with RepositoryProvider**

```typescript
// apps/web/src/application/providers/db-provider.tsx
// ADD imports:
import { RepositoryProvider } from '@traildiary/ui'
import { createRepositories } from '../../infrastructure/di.js'

// INSIDE DbProvider, after db is ready, wrap children:
// ...existing PGlite init...
const repositories = useMemo(() => db ? createRepositories(db) : null, [db])

if (!db || !repositories) return <LoadingScreen />

return (
  <DbContext.Provider value={db}>
    <RepositoryProvider repositories={repositories}>
      {children}
    </RepositoryProvider>
  </DbContext.Provider>
)
```

(Read the actual file before editing to preserve existing structure exactly.)

**Step 3: Verify web app still works**

```bash
pnpm --filter @traildiary/web dev
```

Open browser, verify trails load.

**Step 4: Commit**

```bash
git add apps/web/src/application/providers/db-provider.tsx apps/web/package.json
git commit -m "feat: add RepositoryProvider to web DbProvider for shared hook support"
```

---

### Task 9: Migrate web hooks to use packages/ui hooks

Replace the implementations in `apps/web/src/application/hooks/` with thin wrappers that call packages/ui hooks and add web-specific concerns (File → ArrayBuffer conversion, navigation).

**Files:**
- Modify: `apps/web/src/application/hooks/use-trails.ts`
- Modify: `apps/web/src/application/hooks/use-trail.ts`
- Modify: `apps/web/src/application/hooks/use-import.ts`
- Modify: `apps/web/src/application/hooks/use-add-activity.ts`
- Modify: `apps/web/src/application/hooks/use-remove-day.ts`

**Step 1: Replace use-trails.ts**

```typescript
// apps/web/src/application/hooks/use-trails.ts
export { useTrails } from '@traildiary/ui'
```

**Step 2: Replace use-trail.ts (re-export types too)**

```typescript
// apps/web/src/application/hooks/use-trail.ts
export { useTrail } from '@traildiary/ui'
export type { TrailView, TrailDayView, ActivityView } from '@traildiary/ui'
```

**Step 3: Rewrite use-import.ts as a web wrapper**

```typescript
// apps/web/src/application/hooks/use-import.ts
import { useNavigate } from '@tanstack/react-router'
import { GpxParser, FitParser } from '@traildiary/core'
import { useImport as useSharedImport } from '@traildiary/ui'

const parsers = [new GpxParser(), new FitParser()]

export function useImport() {
  const navigate = useNavigate()
  const { importFiles: importFilesShared, progress } = useSharedImport(parsers)

  async function importFiles(trailName: string, files: File[]) {
    const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name))
    const filesData = await Promise.all(
      sorted.map(async (f) => ({ name: f.name, data: await f.arrayBuffer() }))
    )
    const trailId = await importFilesShared(trailName, filesData)
    if (trailId) navigate({ to: '/trail/$trailId', params: { trailId } })
  }

  return { importFiles, progress }
}
```

**Step 4: Rewrite use-add-activity.ts as a web wrapper**

```typescript
// apps/web/src/application/hooks/use-add-activity.ts
import { GpxParser, FitParser } from '@traildiary/core'
import { useAddActivity as useSharedAddActivity } from '@traildiary/ui'

const parsers = [new GpxParser(), new FitParser()]

export function useAddActivity(trailId: string) {
  const { addFiles: addFilesShared, progress } = useSharedAddActivity(trailId, parsers)

  async function addFiles(files: File[]) {
    const filesData = await Promise.all(
      files.map(async (f) => ({ name: f.name, data: await f.arrayBuffer() }))
    )
    await addFilesShared(filesData)
  }

  return { addFiles, progress }
}
```

**Step 5: Rewrite use-remove-day.ts**

```typescript
// apps/web/src/application/hooks/use-remove-day.ts
export { useRemoveDay } from '@traildiary/ui'
```

**Step 6: Run web dev server and verify all features work**

```bash
pnpm --filter @traildiary/web dev
```

Test: import a GPX, view trail, delete a day.

**Step 7: Commit**

```bash
git add apps/web/src/application/hooks/
git commit -m "refactor: migrate web hooks to thin wrappers over packages/ui shared hooks"
```

---

## Phase 4 — Initialize apps/mobile

### Task 10: Create Expo app skeleton

**Files:**
- Create: `apps/mobile/` (entire directory)

**Step 1: Scaffold Expo app**

```bash
cd apps && npx create-expo-app@latest mobile --template blank-typescript
```

This creates `apps/mobile/` with Expo SDK 52, TypeScript, and basic structure.

**Step 2: Update apps/mobile/package.json name**

Change name to `@traildiary/mobile`.

**Step 3: Add to pnpm-workspace.yaml** (if not already matching `apps/*`)

Check `pnpm-workspace.yaml` — if it already contains `apps/*`, no change needed.

**Step 4: Install workspace packages**

```bash
pnpm install
```

**Step 5: Test bare app runs**

```bash
pnpm --filter @traildiary/mobile start
```

Scan QR code with Expo Go on device, or press `i` for iOS simulator / `a` for Android emulator.

**Step 6: Commit**

```bash
git add apps/mobile/
git commit -m "feat: scaffold Expo mobile app (apps/mobile)"
```

---

### Task 11: Configure Metro bundler for pnpm monorepo

Metro (React Native's bundler) doesn't follow symlinks by default and needs explicit configuration to resolve workspace packages.

**Files:**
- Create: `apps/mobile/metro.config.js`
- Modify: `apps/mobile/app.json` (or `app.config.js`)

**Step 1: Install Metro resolver helper**

```bash
cd apps/mobile && pnpm add -D @expo/metro-config
```

**Step 2: Create metro.config.js**

```javascript
// apps/mobile/metro.config.js
const { getDefaultConfig } = require('@expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// Watch all packages in the monorepo
config.watchFolders = [workspaceRoot]

// Resolve workspace packages
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

// Resolve .ts/.tsx before .js (needed for workspace packages with type:module)
config.resolver.sourceExts = ['tsx', 'ts', 'jsx', 'js', 'json']

module.exports = config
```

**Step 3: Add workspace deps to apps/mobile/package.json**

```json
"dependencies": {
  "@traildiary/core": "workspace:*",
  "@traildiary/ui": "workspace:*"
}
```

**Step 4: Run app and verify imports from packages/ work**

In `apps/mobile/App.tsx`, add a test import:
```typescript
import { GpxParser } from '@traildiary/core'
console.log('core loaded', new GpxParser())
```

Run `pnpm --filter @traildiary/mobile start` and check no module not found errors.

**Step 5: Commit**

```bash
git add apps/mobile/metro.config.js apps/mobile/package.json
git commit -m "feat: configure Metro bundler for pnpm monorepo workspace resolution"
```

---

### Task 12: Set up Expo Router navigation

**Files:**
- Modify: `apps/mobile/app.json` (add `scheme`)
- Create: `apps/mobile/app/` directory with route files
- Delete: `apps/mobile/App.tsx` (replaced by Expo Router)

**Step 1: Install Expo Router**

```bash
cd apps/mobile && npx expo install expo-router react-native-safe-area-context react-native-screens
```

**Step 2: Update app.json / app.config.js**

```json
{
  "expo": {
    "name": "TrailDiary",
    "scheme": "traildiary",
    "web": { "bundler": "metro" },
    "plugins": ["expo-router"]
  }
}
```

**Step 3: Update package.json main entry**

```json
"main": "expo-router/entry"
```

**Step 4: Create root layout**

```typescript
// apps/mobile/app/_layout.tsx
import { Stack } from 'expo-router'
import { SqliteProvider } from '../src/infrastructure/sqlite-provider'

export default function RootLayout() {
  return (
    <SqliteProvider>
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Trails' }} />
        <Stack.Screen name="import" options={{ title: 'Import' }} />
        <Stack.Screen name="trail/[id]" options={{ title: 'Trail' }} />
      </Stack>
    </SqliteProvider>
  )
}
```

**Step 5: Create placeholder screens (to be filled in Phase 6)**

```typescript
// apps/mobile/app/index.tsx
export default function TrailsScreen() {
  return null  // placeholder
}

// apps/mobile/app/import.tsx
export default function ImportScreen() {
  return null  // placeholder
}

// apps/mobile/app/trail/[id].tsx
export default function TrailDetailScreen() {
  return null  // placeholder
}
```

**Step 6: Verify navigation structure loads**

```bash
pnpm --filter @traildiary/mobile start
```

**Step 7: Commit**

```bash
git add apps/mobile/
git commit -m "feat: set up Expo Router with navigation structure for mobile"
```

---

## Phase 5 — Mobile Infrastructure (SQLite Adapters)

### Task 13: Create SQLite schema and client

**Files:**
- Create: `apps/mobile/src/infrastructure/migrations/001-initial.sql`
- Create: `apps/mobile/src/infrastructure/sqlite-client.ts`

**Step 1: Create SQLite migration SQL**

The schema mirrors `packages/db/migrations/001-initial-schema.sql` but adapted for SQLite syntax (no UUID type, no BIGSERIAL — use TEXT and INTEGER).

```sql
-- apps/mobile/src/infrastructure/migrations/001-initial.sql
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS trails (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS trail_days (
  id TEXT PRIMARY KEY,
  trail_id TEXT NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  day_number INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  trail_day_id TEXT NOT NULL REFERENCES trail_days(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_format TEXT NOT NULL,
  distance_km REAL,
  elevation_gain_m REAL,
  elevation_loss_m REAL,
  duration_ms INTEGER,
  moving_time_ms INTEGER,
  avg_speed_kmh REAL,
  start_time INTEGER,
  end_time INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS trackpoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  trail_day_id TEXT NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  elevation REAL,
  timestamp INTEGER,
  point_index INTEGER NOT NULL,
  distance_from_start_m REAL
);

CREATE INDEX IF NOT EXISTS idx_trackpoints_activity ON trackpoints(activity_id);
CREATE INDEX IF NOT EXISTS idx_trackpoints_trail_day ON trackpoints(trail_day_id);
```

**Step 2: Create SQLite client**

```typescript
// apps/mobile/src/infrastructure/sqlite-client.ts
import * as SQLite from 'expo-sqlite'

let db: SQLite.SQLiteDatabase | null = null

export async function getSqliteDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db
  db = await SQLite.openDatabaseAsync('traildiary.db')
  await db.execAsync(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;`)
  return db
}
```

**Step 3: Install expo-sqlite**

```bash
cd apps/mobile && npx expo install expo-sqlite
```

**Step 4: Commit**

```bash
git add apps/mobile/src/infrastructure/
git commit -m "feat: add SQLite schema and client for mobile database"
```

---

### Task 14: Create SqliteTrailRepository

**Files:**
- Create: `apps/mobile/src/infrastructure/sqlite-trail-repository.ts`

```typescript
// apps/mobile/src/infrastructure/sqlite-trail-repository.ts
import type { SQLiteDatabase } from 'expo-sqlite'
import type { TrailRepository, TrailDto, TrailSummaryDto } from '@traildiary/core'
import { uuidv7 } from './uuidv7.js'

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
      'SELECT id, name FROM trails WHERE id = ?', [id]
    )
    return row ?? null
  }

  async listTrails(): Promise<TrailDto[]> {
    return this.db.getAllAsync<TrailDto>('SELECT id, name FROM trails ORDER BY created_at DESC')
  }

  async listTrailSummaries(): Promise<TrailSummaryDto[]> {
    return this.db.getAllAsync<TrailSummaryDto>(`
      SELECT
        t.id,
        t.name,
        COALESCE(SUM(a.distance_km), 0) AS totalDistanceKm,
        MIN(a.start_time) AS startDate,
        MAX(a.end_time) AS endDate,
        COUNT(DISTINCT td.id) AS dayCount
      FROM trails t
      LEFT JOIN trail_days td ON td.trail_id = t.id
      LEFT JOIN activities a ON a.trail_day_id = td.id
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `)
  }

  async deleteTrail(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM trails WHERE id = ?', [id])
  }
}
```

Note: copy `uuidv7.ts` from `packages/db/src/infrastructure/uuidv7.ts` into `apps/mobile/src/infrastructure/uuidv7.ts`.

**Commit:**

```bash
git add apps/mobile/src/infrastructure/sqlite-trail-repository.ts apps/mobile/src/infrastructure/uuidv7.ts
git commit -m "feat: add SqliteTrailRepository for mobile"
```

---

### Task 15: Create SqliteTrailDayRepository and SqliteActivityRepository

**Files:**
- Create: `apps/mobile/src/infrastructure/sqlite-activity-repository.ts`

```typescript
// apps/mobile/src/infrastructure/sqlite-activity-repository.ts
import type { SQLiteDatabase } from 'expo-sqlite'
import type { TrailDayRepository, ActivityRepository, TrailDayDto, ActivityDto } from '@traildiary/core'
import type { TrackStats, SourceFormat } from '@traildiary/core'
import { uuidv7 } from './uuidv7.js'

export class SqliteTrailDayRepository implements TrailDayRepository {
  constructor(private db: SQLiteDatabase) {}

  async createTrailDay(trailId: string, name: string, dayNumber: number): Promise<string> {
    const id = uuidv7()
    await this.db.runAsync(
      'INSERT INTO trail_days (id, trail_id, name, day_number) VALUES (?, ?, ?, ?)',
      [id, trailId, name, dayNumber]
    )
    return id
  }

  async getTrailDays(trailId: string): Promise<TrailDayDto[]> {
    return this.db.getAllAsync<TrailDayDto>(
      'SELECT id, name, day_number AS dayNumber FROM trail_days WHERE trail_id = ? ORDER BY day_number',
      [trailId]
    )
  }

  async deleteTrailDay(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM trail_days WHERE id = ?', [id])
  }
}

export class SqliteActivityRepository implements ActivityRepository {
  constructor(private db: SQLiteDatabase) {}

  async createActivity(
    trailDayId: string, name: string, sourceFormat: SourceFormat,
    stats: TrackStats, sortOrder: number
  ): Promise<string> {
    const id = uuidv7()
    await this.db.runAsync(
      `INSERT INTO activities
        (id, trail_day_id, name, source_format, distance_km, elevation_gain_m,
         elevation_loss_m, duration_ms, moving_time_ms, avg_speed_kmh,
         start_time, end_time, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, trailDayId, name, sourceFormat, stats.distance, stats.elevationGain,
       stats.elevationLoss, stats.duration, stats.movingTime, stats.avgSpeed,
       stats.startTime, stats.endTime, sortOrder]
    )
    return id
  }

  async getActivities(trailDayId: string): Promise<ActivityDto[]> {
    const rows = await this.db.getAllAsync<Record<string, unknown>>(
      `SELECT id, name, source_format AS sourceFormat,
              distance_km, elevation_gain_m, elevation_loss_m,
              duration_ms, moving_time_ms, avg_speed_kmh, start_time, end_time
       FROM activities WHERE trail_day_id = ? ORDER BY sort_order`,
      [trailDayId]
    )
    return rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      sourceFormat: r.sourceFormat as SourceFormat,
      stats: {
        distance: r.distance_km as number,
        elevationGain: r.elevation_gain_m as number,
        elevationLoss: r.elevation_loss_m as number,
        duration: r.duration_ms as number,
        movingTime: r.moving_time_ms as number,
        avgSpeed: r.avg_speed_kmh as number,
        startTime: r.start_time as number,
        endTime: r.end_time as number,
      },
    }))
  }

  async deleteActivity(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM activities WHERE id = ?', [id])
  }
}
```

**Commit:**

```bash
git add apps/mobile/src/infrastructure/sqlite-activity-repository.ts
git commit -m "feat: add SqliteTrailDayRepository and SqliteActivityRepository"
```

---

### Task 16: Create SqliteTrackpointRepository

**Files:**
- Create: `apps/mobile/src/infrastructure/sqlite-trackpoint-repository.ts`

```typescript
// apps/mobile/src/infrastructure/sqlite-trackpoint-repository.ts
import type { SQLiteDatabase } from 'expo-sqlite'
import type { TrackpointRepository } from '@traildiary/core'
import type { TrackPoint } from '@traildiary/core'

export class SqliteTrackpointRepository implements TrackpointRepository {
  constructor(private db: SQLiteDatabase) {}

  async insertTrackpoints(activityId: string, trailDayId: string, points: TrackPoint[]): Promise<void> {
    // Batch insert using transactions for performance
    await this.db.withTransactionAsync(async () => {
      for (let i = 0; i < points.length; i += 500) {
        const chunk = points.slice(i, i + 500)
        const placeholders = chunk.map(() => '(?,?,?,?,?,?,?,?)').join(',')
        const values = chunk.flatMap((p) => [
          activityId, trailDayId, p.lat, p.lon,
          p.elevation ?? null, p.timestamp ?? null,
          p.index, p.distance ?? null,
        ])
        await this.db.runAsync(
          `INSERT INTO trackpoints (activity_id, trail_day_id, lat, lon, elevation, timestamp, point_index, distance_from_start_m) VALUES ${placeholders}`,
          values
        )
      }
    })
  }

  async getTrackpoints(activityId: string): Promise<TrackPoint[]> {
    return this.mapRows(await this.db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM trackpoints WHERE activity_id = ? ORDER BY point_index',
      [activityId]
    ))
  }

  async getTrackpointsSampled(activityId: string, sampleRate: number): Promise<TrackPoint[]> {
    return this.mapRows(await this.db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM trackpoints WHERE activity_id = ? AND point_index % ? = 0 ORDER BY point_index',
      [activityId, sampleRate]
    ))
  }

  async recalculatePointIndices(trailDayId: string, afterActivityId: string): Promise<void> {
    // Re-index all points for a trail day, starting after the given activity
    // Implementation depends on business requirements — leave as no-op for now
  }

  private mapRows(rows: Record<string, unknown>[]): TrackPoint[] {
    return rows.map((r) => ({
      lat: r.lat as number,
      lon: r.lon as number,
      elevation: r.elevation as number ?? 0,
      timestamp: r.timestamp as number ?? 0,
      index: r.point_index as number,
      distance: r.distance_from_start_m as number ?? 0,
    }))
  }
}
```

**Commit:**

```bash
git add apps/mobile/src/infrastructure/sqlite-trackpoint-repository.ts
git commit -m "feat: add SqliteTrackpointRepository with batch insert"
```

---

### Task 17: Create mobile DI factory and SqliteProvider

**Files:**
- Create: `apps/mobile/src/infrastructure/di.ts`
- Create: `apps/mobile/src/infrastructure/sqlite-provider.tsx`

**Step 1: Create DI factory**

```typescript
// apps/mobile/src/infrastructure/di.ts
import type { SQLiteDatabase } from 'expo-sqlite'
import { SqliteTrailRepository } from './sqlite-trail-repository.js'
import { SqliteTrailDayRepository, SqliteActivityRepository } from './sqlite-activity-repository.js'
import { SqliteTrackpointRepository } from './sqlite-trackpoint-repository.js'
import type { Repositories } from '@traildiary/ui'

export function createMobileRepositories(db: SQLiteDatabase): Repositories {
  return {
    trails: new SqliteTrailRepository(db),
    trailDays: new SqliteTrailDayRepository(db),
    activities: new SqliteActivityRepository(db),
    trackpoints: new SqliteTrackpointRepository(db),
  }
}
```

**Step 2: Create SqliteProvider**

```typescript
// apps/mobile/src/infrastructure/sqlite-provider.tsx
import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import * as SQLite from 'expo-sqlite'
import { RepositoryProvider } from '@traildiary/ui'
import { createMobileRepositories } from './di.js'
import { View, Text } from 'react-native'

const MIGRATION_SQL = `
  PRAGMA journal_mode=WAL;
  PRAGMA foreign_keys=ON;
  CREATE TABLE IF NOT EXISTS trails (
    id TEXT PRIMARY KEY, name TEXT NOT NULL,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS trail_days (
    id TEXT PRIMARY KEY, trail_id TEXT NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
    name TEXT NOT NULL, day_number INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY, trail_day_id TEXT NOT NULL REFERENCES trail_days(id) ON DELETE CASCADE,
    name TEXT NOT NULL, source_format TEXT NOT NULL,
    distance_km REAL, elevation_gain_m REAL, elevation_loss_m REAL,
    duration_ms INTEGER, moving_time_ms INTEGER, avg_speed_kmh REAL,
    start_time INTEGER, end_time INTEGER, sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS trackpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    trail_day_id TEXT NOT NULL, lat REAL NOT NULL, lon REAL NOT NULL,
    elevation REAL, timestamp INTEGER, point_index INTEGER NOT NULL,
    distance_from_start_m REAL
  );
  CREATE INDEX IF NOT EXISTS idx_trackpoints_activity ON trackpoints(activity_id);
`

export function SqliteProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    SQLite.openDatabaseAsync('traildiary.db')
      .then(async (database) => {
        await database.execAsync(MIGRATION_SQL)
        setDb(database)
      })
      .catch((e) => setError(String(e)))
  }, [])

  if (error) return <View><Text>DB Error: {error}</Text></View>
  if (!db) return <View><Text>Loading...</Text></View>

  return (
    <RepositoryProvider repositories={createMobileRepositories(db)}>
      {children}
    </RepositoryProvider>
  )
}
```

**Step 3: Update apps/mobile/app/_layout.tsx to use SqliteProvider**

```typescript
// apps/mobile/app/_layout.tsx
import { Stack } from 'expo-router'
import { SqliteProvider } from '../src/infrastructure/sqlite-provider'

export default function RootLayout() {
  return (
    <SqliteProvider>
      <Stack screenOptions={{ headerStyle: { backgroundColor: '#1a1a1a' }, headerTintColor: '#fff' }}>
        <Stack.Screen name="index" options={{ title: 'Trails' }} />
        <Stack.Screen name="import" options={{ title: 'Import Activity' }} />
        <Stack.Screen name="trail/[id]" options={{ title: 'Trail Detail' }} />
      </Stack>
    </SqliteProvider>
  )
}
```

**Step 4: Run app and verify it starts without DB errors**

```bash
pnpm --filter @traildiary/mobile start
```

**Step 5: Commit**

```bash
git add apps/mobile/src/infrastructure/ apps/mobile/app/_layout.tsx
git commit -m "feat: add SqliteProvider with migration + mobile DI factory"
```

---

## Phase 6 — Mobile Screens

### Task 18: Trails List Screen

**Files:**
- Modify: `apps/mobile/app/index.tsx`

**Step 1: Install NativeWind**

```bash
cd apps/mobile && pnpm add nativewind && pnpm add -D tailwindcss
npx tailwindcss init
```

Configure NativeWind per its Expo Router setup guide. Alternatively, use inline StyleSheet styles for the initial implementation and migrate to NativeWind after.

**Step 2: Implement TrailsScreen**

```typescript
// apps/mobile/app/index.tsx
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { useTrails } from '@traildiary/ui'

export default function TrailsScreen() {
  const { trails, loading, deleteTrail } = useTrails()

  if (loading) {
    return <View style={styles.center}><Text style={styles.text}>Loading trails...</Text></View>
  }

  if (trails.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>No trails yet</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.push('/import')}>
          <Text style={styles.buttonText}>Import Activity</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={trails}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.trailCard}
            onPress={() => router.push(`/trail/${item.id}`)}
          >
            <Text style={styles.trailName}>{item.name}</Text>
            <Text style={styles.trailMeta}>
              {item.totalDistanceKm?.toFixed(1)} km · {item.dayCount} days
            </Text>
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity style={styles.fab} onPress={() => router.push('/import')}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' },
  text: { color: '#fff', fontSize: 16 },
  button: { marginTop: 16, backgroundColor: '#3b82f6', padding: 12, borderRadius: 8 },
  buttonText: { color: '#fff', fontWeight: '600' },
  trailCard: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#333' },
  trailName: { color: '#fff', fontSize: 18, fontWeight: '600' },
  trailMeta: { color: '#9ca3af', marginTop: 4 },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center' },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 32 },
})
```

**Step 3: Verify on device**

```bash
pnpm --filter @traildiary/mobile start
```

**Step 4: Commit**

```bash
git add apps/mobile/app/index.tsx
git commit -m "feat: implement TrailsScreen with list + FAB"
```

---

### Task 19: Import Screen

**Files:**
- Modify: `apps/mobile/app/import.tsx`

**Step 1: Install file picking dependencies**

```bash
cd apps/mobile && npx expo install expo-document-picker expo-file-system
```

**Step 2: Implement ImportScreen**

```typescript
// apps/mobile/app/import.tsx
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useState } from 'react'
import { router } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import { GpxParser, FitParser } from '@traildiary/core'
import { useImport } from '@traildiary/ui'

const parsers = [new GpxParser(), new FitParser()]

async function readFileAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })
  const binary = atob(base64)
  const buf = new ArrayBuffer(binary.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i)
  return buf
}

export default function ImportScreen() {
  const [trailName, setTrailName] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<{ name: string; uri: string }[]>([])
  const { importFiles, progress } = useImport(parsers)

  async function pickFiles() {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      type: ['*/*'],
    })
    if (!result.canceled) {
      setSelectedFiles(result.assets.map((a) => ({ name: a.name, uri: a.uri })))
    }
  }

  async function handleImport() {
    if (!trailName.trim() || selectedFiles.length === 0) return
    const filesData = await Promise.all(
      selectedFiles.map(async (f) => ({ name: f.name, data: await readFileAsArrayBuffer(f.uri) }))
    )
    const trailId = await importFiles(trailName.trim(), filesData)
    if (trailId) router.replace(`/trail/${trailId}`)
  }

  const isImporting = progress.status === 'parsing' || progress.status === 'saving'

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Trail name"
        placeholderTextColor="#666"
        value={trailName}
        onChangeText={setTrailName}
      />

      <TouchableOpacity style={styles.button} onPress={pickFiles}>
        <Text style={styles.buttonText}>
          {selectedFiles.length > 0 ? `${selectedFiles.length} files selected` : 'Pick GPX / FIT files'}
        </Text>
      </TouchableOpacity>

      {selectedFiles.map((f) => (
        <Text key={f.uri} style={styles.fileName}>{f.name}</Text>
      ))}

      {isImporting && (
        <View style={styles.progress}>
          <ActivityIndicator color="#3b82f6" />
          <Text style={styles.progressText}>{progress.message}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.importBtn, (!trailName || !selectedFiles.length || isImporting) && styles.disabled]}
        onPress={handleImport}
        disabled={!trailName || !selectedFiles.length || isImporting}
      >
        <Text style={styles.buttonText}>Import</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', padding: 16 },
  input: { backgroundColor: '#222', color: '#fff', padding: 12, borderRadius: 8, marginBottom: 12, fontSize: 16 },
  button: { backgroundColor: '#374151', padding: 14, borderRadius: 8, alignItems: 'center', marginBottom: 8 },
  importBtn: { backgroundColor: '#3b82f6', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  disabled: { opacity: 0.5 },
  fileName: { color: '#9ca3af', marginVertical: 2 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8 },
  progressText: { color: '#9ca3af' },
})
```

**Step 3: Verify on device — pick a GPX file and import**

**Step 4: Commit**

```bash
git add apps/mobile/app/import.tsx
git commit -m "feat: implement ImportScreen with expo-document-picker"
```

---

### Task 20: Trail Detail Screen — Stats + Day List

**Files:**
- Modify: `apps/mobile/app/trail/[id].tsx`
- Create: `apps/mobile/src/ui/components/stats-panel.tsx`
- Create: `apps/mobile/src/ui/components/day-list.tsx`

**Step 1: Create StatsPanel component**

```typescript
// apps/mobile/src/ui/components/stats-panel.tsx
import { View, Text, StyleSheet } from 'react-native'
import type { TrackStats } from '@traildiary/core'

function formatDuration(ms: number) {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return `${h}h ${m}m`
}

export function StatsPanel({ stats }: { stats: TrackStats }) {
  return (
    <View style={styles.row}>
      <Stat label="Distance" value={`${stats.distance.toFixed(1)} km`} />
      <Stat label="↑ Gain" value={`${Math.round(stats.elevationGain)} m`} />
      <Stat label="↓ Loss" value={`${Math.round(stats.elevationLoss)} m`} />
      <Stat label="Duration" value={formatDuration(stats.duration)} />
    </View>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#1f2937', padding: 12, borderRadius: 8 },
  stat: { alignItems: 'center' },
  value: { color: '#fff', fontWeight: '600', fontSize: 16 },
  label: { color: '#9ca3af', fontSize: 12, marginTop: 2 },
})
```

**Step 2: Create DayList component**

```typescript
// apps/mobile/src/ui/components/day-list.tsx
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import type { TrailDayView } from '@traildiary/ui'

interface Props {
  days: TrailDayView[]
  selectedDayId: string | null
  onSelectDay: (dayId: string) => void
}

export function DayList({ days, selectedDayId, onSelectDay }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
      {days.map((day) => (
        <TouchableOpacity
          key={day.id}
          style={[styles.tab, selectedDayId === day.id && styles.activeTab]}
          onPress={() => onSelectDay(day.id)}
        >
          <Text style={[styles.tabText, selectedDayId === day.id && styles.activeText]}>
            Day {day.dayNumber}
          </Text>
          <Text style={styles.tabMeta}>{day.name}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 60 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, marginRight: 8, borderRadius: 8, backgroundColor: '#374151' },
  activeTab: { backgroundColor: '#3b82f6' },
  tabText: { color: '#9ca3af', fontWeight: '600' },
  activeText: { color: '#fff' },
  tabMeta: { color: '#6b7280', fontSize: 11 },
})
```

**Step 3: Implement TrailDetailScreen (stats + day list; map + chart in next tasks)**

```typescript
// apps/mobile/app/trail/[id].tsx
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { useTrail } from '@traildiary/ui'
import { StatsPanel } from '../../src/ui/components/stats-panel'
import { DayList } from '../../src/ui/components/day-list'

export default function TrailDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { trail, loading } = useTrail(id)
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null)

  if (loading) return <View style={styles.center}><Text style={styles.text}>Loading...</Text></View>
  if (!trail) return <View style={styles.center}><Text style={styles.text}>Trail not found</Text></View>

  const activeDay = trail.days.find((d) => d.id === selectedDayId) ?? trail.days[0]

  return (
    <View style={styles.container}>
      {/* Map placeholder — filled in Task 21 */}
      <View style={styles.mapPlaceholder}>
        <Text style={styles.text}>Map View</Text>
      </View>

      <ScrollView style={styles.panel}>
        <Text style={styles.trailName}>{trail.name}</Text>
        <StatsPanel stats={activeDay?.stats ?? trail.stats} />

        <DayList
          days={trail.days}
          selectedDayId={selectedDayId ?? trail.days[0]?.id ?? null}
          onSelectDay={setSelectedDayId}
        />

        {/* Elevation chart placeholder — filled in Task 22 */}
        <View style={styles.chartPlaceholder}>
          <Text style={styles.text}>Elevation Chart</Text>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' },
  mapPlaceholder: { height: 300, backgroundColor: '#1f2937', alignItems: 'center', justifyContent: 'center' },
  chartPlaceholder: { height: 150, backgroundColor: '#1f2937', alignItems: 'center', justifyContent: 'center', marginTop: 12, borderRadius: 8 },
  panel: { padding: 16 },
  trailName: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 12 },
  text: { color: '#9ca3af' },
})
```

**Step 4: Commit**

```bash
git add apps/mobile/app/trail/ apps/mobile/src/ui/components/
git commit -m "feat: implement TrailDetailScreen with stats and day selector"
```

---

### Task 21: MapView Component (MapLibre React Native)

**Files:**
- Create: `apps/mobile/src/ui/components/map-view.tsx`

**Step 1: Install MapLibre React Native**

```bash
cd apps/mobile && npx expo install @maplibre/maplibre-react-native
```

Add the plugin to `app.json`:
```json
"plugins": ["expo-router", "@maplibre/maplibre-react-native"]
```

Follow the expo-maplibre-react-native setup guide for native configuration (may require `expo prebuild`).

**Step 2: Implement MapView**

```typescript
// apps/mobile/src/ui/components/map-view.tsx
import MapLibreGL from '@maplibre/maplibre-react-native'
import { StyleSheet, View } from 'react-native'
import type { TrackPoint } from '@traildiary/core'
import { useMemo } from 'react'

MapLibreGL.setAccessToken(null) // OpenFreeMap tiles don't need a token

const TILE_URL = 'https://tiles.openfreemap.org/styles/liberty'

interface Props {
  activities: Array<{ id: string; simplifiedPoints: TrackPoint[] }>
  selectedActivityId?: string | null
}

export function MobileMapView({ activities, selectedActivityId }: Props) {
  const geoJsonSource = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: activities.map((act) => ({
      type: 'Feature' as const,
      properties: { id: act.id, selected: act.id === selectedActivityId },
      geometry: {
        type: 'LineString' as const,
        coordinates: act.simplifiedPoints.map((p) => [p.lon, p.lat]),
      },
    })),
  }), [activities, selectedActivityId])

  const bounds = useMemo(() => {
    const allPoints = activities.flatMap((a) => a.simplifiedPoints)
    if (allPoints.length === 0) return null
    return {
      ne: [Math.max(...allPoints.map((p) => p.lon)), Math.max(...allPoints.map((p) => p.lat))] as [number, number],
      sw: [Math.min(...allPoints.map((p) => p.lon)), Math.min(...allPoints.map((p) => p.lat))] as [number, number],
    }
  }, [activities])

  return (
    <View style={styles.container}>
      <MapLibreGL.MapView style={styles.map} styleURL={TILE_URL}>
        <MapLibreGL.Camera
          bounds={bounds ?? undefined}
          padding={{ paddingTop: 40, paddingBottom: 40, paddingLeft: 40, paddingRight: 40 }}
          animationMode="flyTo"
        />
        <MapLibreGL.ShapeSource id="routes" shape={geoJsonSource}>
          <MapLibreGL.LineLayer
            id="route-lines"
            style={{ lineColor: ['case', ['get', 'selected'], '#f97316', '#3b82f6'], lineWidth: 3 }}
          />
        </MapLibreGL.ShapeSource>
      </MapLibreGL.MapView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
})
```

**Step 3: Replace map placeholder in TrailDetailScreen**

```typescript
// In apps/mobile/app/trail/[id].tsx:
// Replace <View style={styles.mapPlaceholder}> with:
<View style={{ height: 300 }}>
  <MobileMapView
    activities={activeDay?.activities ?? []}
    selectedActivityId={null}
  />
</View>
```

**Step 4: Commit**

```bash
git add apps/mobile/src/ui/components/map-view.tsx apps/mobile/app/trail/
git commit -m "feat: add MapLibre map view to mobile trail detail"
```

---

### Task 22: Elevation Chart Component

**Files:**
- Create: `apps/mobile/src/ui/components/elevation-chart.tsx`

**Step 1: Install victory-native**

```bash
cd apps/mobile && pnpm add victory-native react-native-svg
npx expo install react-native-svg
```

**Step 2: Implement ElevationChart**

```typescript
// apps/mobile/src/ui/components/elevation-chart.tsx
import { VictoryChart, VictoryLine, VictoryAxis, VictoryTheme } from 'victory-native'
import { View, Dimensions } from 'react-native'
import type { TrackPoint } from '@traildiary/core'
import { useMemo } from 'react'
import { downsampleForChart } from '@traildiary/core'

interface Props {
  points: TrackPoint[]
  color?: string
}

export function ElevationChart({ points, color = '#3b82f6' }: Props) {
  const chartData = useMemo(() => {
    const sampled = downsampleForChart(points, 200)
    return sampled.map((p) => ({ x: p.distance, y: p.elevation }))
  }, [points])

  const width = Dimensions.get('window').width - 32

  if (chartData.length < 2) return null

  return (
    <View>
      <VictoryChart
        width={width}
        height={150}
        theme={VictoryTheme.material}
        padding={{ top: 10, bottom: 30, left: 40, right: 10 }}
      >
        <VictoryAxis
          style={{ tickLabels: { fill: '#9ca3af', fontSize: 10 }, axis: { stroke: '#374151' } }}
          tickFormat={(t: number) => `${t.toFixed(1)}km`}
          tickCount={4}
        />
        <VictoryAxis
          dependentAxis
          style={{ tickLabels: { fill: '#9ca3af', fontSize: 10 }, axis: { stroke: '#374151' } }}
          tickFormat={(t: number) => `${Math.round(t)}m`}
          tickCount={4}
        />
        <VictoryLine
          data={chartData}
          style={{ data: { stroke: color, strokeWidth: 2 } }}
          interpolation="monotoneX"
        />
      </VictoryChart>
    </View>
  )
}
```

**Step 3: Replace chart placeholder in TrailDetailScreen**

```typescript
// In apps/mobile/app/trail/[id].tsx:
// Replace chartPlaceholder View with:
{activeDay && activeDay.activities[0] && (
  <ElevationChart points={activeDay.activities[0].simplifiedPoints} />
)}
```

**Step 4: Commit**

```bash
git add apps/mobile/src/ui/components/elevation-chart.tsx apps/mobile/app/trail/
git commit -m "feat: add elevation chart (victory-native) to mobile trail detail"
```

---

## Phase 7 — Final Verification

### Task 23: End-to-end verification

**Step 1: Run all package tests**

```bash
pnpm --filter @traildiary/core test
pnpm --filter @traildiary/ui test
```

Expected: all tests PASS

**Step 2: Run web app and verify no regressions**

```bash
pnpm --filter @traildiary/web dev
```

Test: import a GPX, view trail on map, check elevation chart, delete a day.

**Step 3: Run mobile app on device/emulator**

```bash
pnpm --filter @traildiary/mobile start
```

Test:
- [ ] Trails list loads (empty state shown)
- [ ] Tap + opens import screen
- [ ] Pick a GPX file, enter trail name, tap Import
- [ ] App navigates to trail detail
- [ ] Stats display correctly
- [ ] Day tabs work
- [ ] Map shows the route
- [ ] Elevation chart shows profile
- [ ] Navigate back to trails list — trail appears

**Step 4: Final commit**

```bash
git add .
git commit -m "feat: complete mobile React Native app with shared DDD+hexagonal architecture"
```

---

## Architecture Summary (Hexagonal)

```
packages/core/domain/         ← Trail, TrackPoint, TrackStats, algorithms
packages/core/application/    ← FileParser port, Repository ports, DTOs
packages/ui/                  ← RepositoryProvider, useTrails, useTrail, useImport,
                                 useAddActivity, useRemoveDay, TrailView types

apps/web/
  infrastructure/             ← PgliteTrailRepository (PGlite adapter)
  application/providers/      ← DbProvider → RepositoryProvider (web DI)
  application/hooks/          ← Thin wrappers: File→ArrayBuffer + navigation
  ui/components/              ← MapLibre GL, Recharts, FileDropZone (web-only)

apps/mobile/
  infrastructure/             ← SqliteTrailRepository (expo-sqlite adapter)
  infrastructure/             ← SqliteProvider → RepositoryProvider (mobile DI)
  app/                        ← Screens: index, import, trail/[id] (Expo Router)
  src/ui/components/          ← MapLibre RN, victory-native, DayList (mobile-only)
```

**Port/Adapter table:**

| Port | Web Adapter | Mobile Adapter |
|------|-------------|----------------|
| `TrailRepository` | `PgliteTrailRepository` | `SqliteTrailRepository` |
| `TrailDayRepository` | `PgliteTrailDayRepository` | `SqliteTrailDayRepository` |
| `ActivityRepository` | `PgliteActivityRepository` | `SqliteActivityRepository` |
| `TrackpointRepository` | `PgliteTrackpointRepository` | `SqliteTrackpointRepository` |
| `FileParser` | `GpxParser`, `FitParser` (shared) | same |
| File I/O | `File.arrayBuffer()` (browser) | `FileSystem.readAsStringAsync` (Expo) |
| Navigation | TanStack Router `useNavigate` | `expo-router` `router.push` |
| Map | `react-map-gl` (MapLibre GL) | `@maplibre/maplibre-react-native` |
| Chart | `recharts` | `victory-native` |
