import type { TrackStats } from '../domain/track-stats.js'
import type { SourceFormat } from '../domain/trail.js'

export interface Trail {
  id: string
  name: string
}

export interface TrailDay {
  id: string
  name: string
  dayNumber: number
}

export interface Activity {
  id: string
  name: string
  sourceFormat: SourceFormat
  stats: TrackStats
  sortOrder: number
}
