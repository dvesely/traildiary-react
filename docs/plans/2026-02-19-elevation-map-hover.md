# Elevation Graph ↔ Map Hover Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bidirectional hover sync — hovering the elevation graph shows a dot on the map trail; hovering the map trail shows a vertical reference line on the elevation graph.

**Architecture:** `hoveredPoint: TrackPoint | null` state lives in `TrailPage` and flows down as props + callbacks to `ElevationChart` and `MapView`. A pure `findNearestPoint` utility (in core) resolves lat/lon ↔ chart-data index. No new libraries.

**Tech Stack:** React useState, Recharts ReferenceLine, MapLibre GeoJSON circle layer, vitest for unit tests.

---

### Task 1: Add `findNearestPoint` to core

**Files:**
- Create: `packages/core/src/domain/find-nearest-point.ts`
- Create: `packages/core/src/__tests__/domain/find-nearest-point.test.ts`
- Modify: `packages/core/src/index.ts`

**Step 1: Write the failing test**

Create `packages/core/src/__tests__/domain/find-nearest-point.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { findNearestPoint } from '../../domain/find-nearest-point.js'
import type { TrackPoint } from '../../domain/trackpoint.js'

function pt(lat: number, lon: number): TrackPoint {
  return { lat, lon, elevation: 0, timestamp: 0 }
}

describe('findNearestPoint', () => {
  it('returns null for empty array', () => {
    expect(findNearestPoint([], 50.0, 14.0)).toBeNull()
  })

  it('returns the single point when array has one entry', () => {
    const p = pt(50.0, 14.0)
    expect(findNearestPoint([p], 50.0, 14.0)).toBe(p)
  })

  it('returns the closest point by haversine distance', () => {
    const near = pt(50.0, 14.0)
    const far = pt(51.0, 15.0)
    expect(findNearestPoint([near, far], 50.001, 14.001)).toBe(near)
    expect(findNearestPoint([near, far], 50.999, 14.999)).toBe(far)
  })
})
```

**Step 2: Run test to verify it fails**

```
cd packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -E "find-nearest|FAIL|Cannot"
```

Expected: FAIL — module not found.

**Step 3: Implement `findNearestPoint`**

Create `packages/core/src/domain/find-nearest-point.ts`:

```ts
import { haversineDistance } from './track-stats.js'
import type { TrackPoint } from './trackpoint.js'

export function findNearestPoint(points: TrackPoint[], lat: number, lon: number): TrackPoint | null {
  if (points.length === 0) return null
  const cursor: TrackPoint = { lat, lon, elevation: 0, timestamp: 0 }
  let nearest = points[0]
  let minDist = haversineDistance(cursor, nearest)
  for (let i = 1; i < points.length; i++) {
    const d = haversineDistance(cursor, points[i])
    if (d < minDist) {
      minDist = d
      nearest = points[i]
    }
  }
  return nearest
}
```

**Step 4: Export from index**

In `packages/core/src/index.ts`, add to the Domain exports line:

```ts
export { findNearestPoint } from './domain/find-nearest-point.js'
```

**Step 5: Run tests to verify they pass**

```
cd packages/core && pnpm test -- --reporter=verbose
```

Expected: all tests pass including the 3 new `findNearestPoint` tests.

**Step 6: Commit**

```bash
git add packages/core/src/domain/find-nearest-point.ts \
        packages/core/src/__tests__/domain/find-nearest-point.test.ts \
        packages/core/src/index.ts
git commit -m "feat(core): add findNearestPoint utility"
```

---

### Task 2: Extend `ChartDataPoint` with lat/lon

**Files:**
- Modify: `apps/web/src/ui/components/elevation-chart.tsx`

`ChartDataPoint` needs `lat` and `lon` so an active index can be mapped back to GPS coordinates.

**Step 1: Update `ChartDataPoint` interface**

In `elevation-chart.tsx`, change:

```ts
interface ChartDataPoint {
  distance: number
  elevation: number
}
```

to:

```ts
interface ChartDataPoint {
  distance: number
  elevation: number
  lat: number
  lon: number
}
```

**Step 2: Update `buildChartData`**

Change the two `data.push` calls to include `lat`/`lon`:

```ts
const data: ChartDataPoint[] = [{ distance: 0, elevation: points[0].elevation, lat: points[0].lat, lon: points[0].lon }]

// inside loop:
data.push({ distance: Math.round(cumDistance * 10) / 10, elevation: Math.round(points[i].elevation), lat: points[i].lat, lon: points[i].lon })
```

**Step 3: Verify TypeScript compiles**

```
cd apps/web && pnpm tsc --noEmit
```

Expected: no errors.

**Step 4: Commit**

```bash
git add apps/web/src/ui/components/elevation-chart.tsx
git commit -m "feat(web): extend ChartDataPoint with lat/lon"
```

---

### Task 3: Add hover callbacks to `ElevationChart` (chart→map direction)

**Files:**
- Modify: `apps/web/src/ui/components/elevation-chart.tsx`

**Step 1: Update props interface**

```ts
import type { TrackPoint } from '@traildiary/core'

interface ElevationChartProps {
  points: TrackPoint[]
  height?: number
  onHoverPoint?: (point: TrackPoint | null) => void
}
```

**Step 2: Destructure new prop**

```ts
export function ElevationChart({ points, height = 176, onHoverPoint }: ElevationChartProps) {
  const data = buildChartData(points)
```

**Step 3: Add `onMouseMove` and `onMouseLeave` to `AreaChart`**

Replace the opening `<AreaChart` tag:

```tsx
<AreaChart
  data={data}
  margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
  onMouseMove={(e) => {
    if (!onHoverPoint) return
    if (e.activeTooltipIndex !== undefined && data[e.activeTooltipIndex]) {
      const d = data[e.activeTooltipIndex]
      onHoverPoint({ lat: d.lat, lon: d.lon, elevation: d.elevation, timestamp: 0 })
    }
  }}
  onMouseLeave={() => onHoverPoint?.(null)}
>
```

**Step 4: Verify TypeScript compiles**

```
cd apps/web && pnpm tsc --noEmit
```

Expected: no errors.

**Step 5: Commit**

```bash
git add apps/web/src/ui/components/elevation-chart.tsx
git commit -m "feat(web): elevation chart fires onHoverPoint on mouse move"
```

---

### Task 4: Add `ReferenceLine` to `ElevationChart` (map→chart direction)

**Files:**
- Modify: `apps/web/src/ui/components/elevation-chart.tsx`

**Step 1: Add `hoveredPoint` prop and import `ReferenceLine`**

Update the import line:

```ts
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
```

Update props interface:

```ts
interface ElevationChartProps {
  points: TrackPoint[]
  height?: number
  hoveredPoint?: TrackPoint | null
  onHoverPoint?: (point: TrackPoint | null) => void
}
```

Destructure it:

```ts
export function ElevationChart({ points, height = 176, hoveredPoint, onHoverPoint }: ElevationChartProps) {
```

**Step 2: Compute hovered distance**

Inside the component body, after `const data = buildChartData(points)`, add:

```ts
import { findNearestPoint } from '@traildiary/core'

// Find the chart x-position matching the hovered GPS point
let hoveredDistance: number | undefined
if (hoveredPoint && data.length > 0) {
  const nearest = findNearestPoint(points, hoveredPoint.lat, hoveredPoint.lon)
  if (nearest) {
    const idx = points.indexOf(nearest)
    if (idx !== -1 && data[idx]) hoveredDistance = data[idx].distance
  }
}
```

**Step 3: Render `ReferenceLine` inside `AreaChart`**

After the `<Area>` element, add:

```tsx
{hoveredDistance !== undefined && (
  <ReferenceLine
    x={hoveredDistance}
    stroke="#ffffff"
    strokeWidth={1}
    strokeDasharray="3 3"
  />
)}
```

**Step 4: Verify TypeScript compiles**

```
cd apps/web && pnpm tsc --noEmit
```

Expected: no errors.

**Step 5: Commit**

```bash
git add apps/web/src/ui/components/elevation-chart.tsx
git commit -m "feat(web): elevation chart shows reference line when map hovered"
```

---

### Task 5: Add hover dot layer to `MapView` (chart→map direction)

**Files:**
- Modify: `apps/web/src/ui/components/map-view.tsx`

**Step 1: Add `hoveredPoint` prop**

```ts
import type { TrackPoint } from '@traildiary/core'

interface MapViewProps {
  days: TrailDayView[]
  selectedDayId: string | null
  hoveredPoint?: TrackPoint | null
}
```

Destructure:

```ts
export function MapView({ days, selectedDayId, hoveredPoint }: MapViewProps) {
```

**Step 2: Add hover-point source and layer during map init**

In the first `useEffect` (map initialization), after `map.addControl(...)` add:

```ts
map.on('load', () => {
  map.addSource('hover-point', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addLayer({
    id: 'hover-point-circle',
    type: 'circle',
    source: 'hover-point',
    paint: {
      'circle-radius': 6,
      'circle-color': '#ffffff',
      'circle-stroke-color': '#3b82f6',
      'circle-stroke-width': 2,
    },
  })
})
```

**Step 3: Add `useEffect` to update hover dot**

After the existing two useEffects, add:

```ts
useEffect(() => {
  const map = mapRef.current
  if (!map || !map.isStyleLoaded()) return

  const source = map.getSource('hover-point') as maplibregl.GeoJSONSource | undefined
  if (!source) return

  if (hoveredPoint) {
    source.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: [hoveredPoint.lon, hoveredPoint.lat] },
    })
  } else {
    source.setData({ type: 'FeatureCollection', features: [] })
  }
}, [hoveredPoint])
```

**Step 4: Verify TypeScript compiles**

```
cd apps/web && pnpm tsc --noEmit
```

Expected: no errors.

**Step 5: Commit**

```bash
git add apps/web/src/ui/components/map-view.tsx
git commit -m "feat(web): map shows hover dot when elevation chart is hovered"
```

---

### Task 6: Add map mousemove → `onHoverPoint` to `MapView` (map→chart direction)

**Files:**
- Modify: `apps/web/src/ui/components/map-view.tsx`

**Step 1: Add `chartPoints` and `onHoverPoint` props**

```ts
import { findNearestPoint } from '@traildiary/core'

interface MapViewProps {
  days: TrailDayView[]
  selectedDayId: string | null
  hoveredPoint?: TrackPoint | null
  chartPoints?: TrackPoint[]
  onHoverPoint?: (point: TrackPoint | null) => void
}
```

Destructure:

```ts
export function MapView({ days, selectedDayId, hoveredPoint, chartPoints, onHoverPoint }: MapViewProps) {
```

**Step 2: Store callbacks in refs to avoid stale closures**

At the top of the component body, add:

```ts
const chartPointsRef = useRef<TrackPoint[]>(chartPoints ?? [])
const onHoverPointRef = useRef(onHoverPoint)

useEffect(() => { chartPointsRef.current = chartPoints ?? [] }, [chartPoints])
useEffect(() => { onHoverPointRef.current = onHoverPoint }, [onHoverPoint])
```

**Step 3: Register mousemove/mouseleave in the map init useEffect**

After adding the hover-point layer (still inside the `map.on('load', ...)` callback), add:

```ts
map.on('mousemove', (e) => {
  const pts = chartPointsRef.current
  if (pts.length === 0) return
  const nearest = findNearestPoint(pts, e.lngLat.lat, e.lngLat.lng)
  onHoverPointRef.current?.(nearest)
})

map.on('mouseleave', () => {
  onHoverPointRef.current?.(null)
})
```

**Step 4: Verify TypeScript compiles**

```
cd apps/web && pnpm tsc --noEmit
```

Expected: no errors.

**Step 5: Commit**

```bash
git add apps/web/src/ui/components/map-view.tsx
git commit -m "feat(web): map mousemove fires onHoverPoint for chart sync"
```

---

### Task 7: Wire everything in `TrailPage`

**Files:**
- Modify: `apps/web/src/routes/trail.$trailId.tsx`

**Step 1: Add `hoveredPoint` state**

Add import for `TrackPoint`:

```ts
import type { TrackPoint } from '@traildiary/core'
```

Add state:

```ts
const [hoveredPoint, setHoveredPoint] = useState<TrackPoint | null>(null)
```

**Step 2: Pass new props to `MapView`**

```tsx
<MapView
  days={trail.days}
  selectedDayId={selectedDayId}
  hoveredPoint={hoveredPoint}
  chartPoints={chartPoints}
  onHoverPoint={setHoveredPoint}
/>
```

**Step 3: Pass new props to `ElevationChart`**

```tsx
<ElevationChart
  points={chartPoints}
  height={176}
  hoveredPoint={hoveredPoint}
  onHoverPoint={setHoveredPoint}
/>
```

**Step 4: Verify TypeScript compiles**

```
cd apps/web && pnpm tsc --noEmit
```

Expected: no errors.

**Step 5: Run all core tests**

```
cd packages/core && pnpm test
```

Expected: all pass.

**Step 6: Manual smoke test**

Start the dev server:
```
cd apps/web && pnpm dev
```

- Open a trail with elevation data
- Hover along the elevation graph → a white/blue dot should appear and move along the trail on the map
- Hover over the trail on the map → a dashed vertical line should appear and move on the elevation graph
- Moving mouse off either component should clear both indicators

**Step 7: Final commit**

```bash
git add apps/web/src/routes/trail.\$trailId.tsx
git commit -m "feat(web): wire elevation-map bidirectional hover in TrailPage"
```
