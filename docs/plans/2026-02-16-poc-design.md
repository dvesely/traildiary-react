# TrailDiary PoC Design

## Goal

Prove that GPX/FIT parsing and map visualization work for thru-hike scale data (30 days, 10h/day, multiple activities per day). Web-only, client-side, with offline persistence.

## Tech Stack

- **Monorepo:** pnpm workspaces
- **Language:** TypeScript (strict)
- **Web app:** Vite + React + TanStack Router
- **Map:** MapLibre GL JS (open-source, offline tile support)
- **Chart:** Recharts (elevation profile)
- **Styling:** Tailwind CSS
- **Offline DB:** PGlite (Postgres in WASM, OPFS persistence)
- **Testing:** Vitest
- **Linting:** ESLint + Prettier

## Architecture

DDD + Hexagonal. Dependency flows inward: infrastructure → application → domain.

### packages/core

Pure TypeScript, no framework dependencies.

```
core/
├── domain/
│   ├── trail.ts              # Trail, TrailDay, Activity entities
│   ├── trackpoint.ts         # TrackPoint value object
│   ├── track-stats.ts        # TrackStats value object + computation
│   ├── track-simplifier.ts   # Douglas-Peucker (domain service)
│   └── track-downsampler.ts  # LTTB algorithm (domain service)
├── application/
│   ├── import-activities.ts  # Use case: parse files → domain objects
│   ├── get-trail-view.ts     # Use case: load trail with simplified data
│   └── ports.ts              # Repository interfaces (driven ports)
├── infrastructure/
│   ├── gpx-parser.ts         # GPX adapter
│   └── fit-parser.ts         # FIT adapter
└── index.ts
```

### packages/db

Infrastructure adapter implementing repository ports from core.

```
db/
├── infrastructure/
│   ├── pglite-client.ts          # PGlite setup + OPFS config
│   ├── trail-repository.ts       # Implements TrailRepository port
│   ├── activity-repository.ts    # Implements ActivityRepository port
│   └── trackpoint-repository.ts  # Implements TrackpointRepository port
├── migrations/
│   └── 001-initial-schema.sql
└── index.ts
```

### apps/web

```
web/
├── infrastructure/
│   ├── worker/
│   │   ├── parse-worker.ts       # Web Worker entry
│   │   └── worker-client.ts      # Main thread ↔ worker bridge
│   └── di.ts                     # Dependency injection / wiring
├── application/
│   ├── hooks/
│   │   ├── use-import.ts         # File import orchestration
│   │   ├── use-trail.ts          # Trail data loading
│   │   └── use-activity.ts       # Activity selection state
│   └── providers/
│       └── db-provider.tsx       # PGlite context provider
├── ui/
│   ├── pages/
│   │   ├── home-page.tsx         # File drop zone
│   │   └── trail-page.tsx        # Map + elevation + stats
│   ├── components/
│   │   ├── map-view.tsx          # MapLibre wrapper
│   │   ├── elevation-chart.tsx   # Recharts elevation profile
│   │   ├── stats-panel.tsx       # Stats display
│   │   ├── day-sidebar.tsx       # Trail day list
│   │   └── file-drop-zone.tsx    # Drag & drop input
│   └── layout/
│       └── app-layout.tsx
├── routes/
│   ├── __root.tsx
│   ├── index.tsx                 # → home-page
│   └── trail.$trailId.tsx        # → trail-page
└── main.tsx
```

## Domain Model

```typescript
interface TrackPoint {
  lat: number
  lon: number
  elevation: number     // meters
  timestamp: number     // unix ms
  heartRate?: number
  cadence?: number
}

interface Track {
  name: string
  points: TrackPoint[]
  source: 'gpx' | 'fit'
}

interface TrackStats {
  distance: number       // km
  elevationGain: number  // m
  elevationLoss: number  // m
  duration: number       // ms (total elapsed)
  movingTime: number     // ms (excluding stops)
  avgSpeed: number       // km/h (moving)
  startTime: number
  endTime: number
}
```

## Database Schema

```sql
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

UUIDs for sync-friendly IDs. Stats denormalized on activities for fast reads. Trackpoints loaded lazily.

## Data Flow

### First import

1. User creates a trail (e.g. "PCT 2025")
2. Drops/selects files — Web Worker parses all, UI shows progress
3. Files assigned to trail days (auto-detect by date or manual ordering)
4. Data persisted to PGlite (OPFS)
5. Navigate to `/trail/:id`

### Return visit

1. PGlite reads from OPFS — data already there
2. Query trail_days + activities for sidebar
3. Trackpoints loaded on demand per day/activity
4. Simplify + downsample before rendering

## Performance Strategy

- **Web Worker** for parsing — UI never blocks
- **Douglas-Peucker** track simplification for map rendering (~500-1000 pts/day)
- **LTTB** downsampling for elevation chart (~2000 pts for full trail)
- **Elevation smoothing** (moving average) before computing gain/loss
- **Lazy trackpoint loading** — query from PGlite only when needed
- **SQL-level downsampling** — `WHERE point_index % N = 0` for full trail view

## UI Layout

```
┌─────────────────────────────────────┐
│  Sidebar (day list)  │    Map       │
│  ┌─────────────────┐ │  (MapLibre)  │
│  │ Day 1 - 24km    │ │              │
│  │ Day 2 - 31km    │ │  track lines │
│  │ Day 3 - 28km    │ │  color-coded │
│  │ ...             │ │  per day     │
│  │ Trail total     │ │              │
│  └─────────────────┘ │              │
├──────────────────────┴──────────────┤
│  Elevation Profile (full trail or   │
│  selected day)                      │
├─────────────────────────────────────┤
│  Stats Panel (selected day or trail)│
└─────────────────────────────────────┘
```

### Interactions

- Click day in sidebar → highlight track on map, show day elevation + stats
- Click "Trail total" → all tracks, combined elevation, aggregated stats
- Hover elevation chart → crosshair marker moves on map (and vice versa)

## Out of Scope

- Backend / API
- Authentication
- Sync between devices
- Mobile app (React Native)
- Offline tile downloading (MapLibre supports it, but not in PoC)
- Photos / notes
