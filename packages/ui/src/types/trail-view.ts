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
