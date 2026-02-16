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
