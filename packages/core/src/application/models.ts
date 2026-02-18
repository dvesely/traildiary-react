import type { TrackStats } from '../domain/track-stats.js'
import type { SourceFormat } from '../domain/trail.js'

export interface TrailDto {
  id: string
  name: string
}

export interface TrailDayDto {
  id: string
  name: string
  dayNumber: number
}

export interface ActivityDto {
  id: string
  name: string
  sourceFormat: SourceFormat
  stats: TrackStats
  sortOrder: number
}

export interface TrailSummaryDto {
  id: string
  name: string
  totalDistance: number
  startAt: number | null
  endAt: number | null
}
