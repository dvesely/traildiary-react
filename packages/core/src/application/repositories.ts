import type { TrackPoint } from '../domain/trackpoint.js'
import type { TrackStats } from '../domain/track-stats.js'
import type { SourceFormat } from '../domain/trail.js'
import type { TrailDto, TrailDayDto, ActivityDto } from './models.js'

export interface TrailRepository {
  createTrail(name: string): Promise<string>
  getTrail(id: string): Promise<TrailDto | null>
  listTrails(): Promise<TrailDto[]>
}

export interface TrailDayRepository {
  createTrailDay(trailId: string, name: string, dayNumber: number): Promise<string>
  getTrailDays(trailId: string): Promise<TrailDayDto[]>
  deleteTrailDay(id: string): Promise<void>
}

export interface ActivityRepository {
  createActivity(trailDayId: string, name: string, sourceFormat: SourceFormat, stats: TrackStats, sortOrder: number): Promise<string>
  getActivities(trailDayId: string): Promise<ActivityDto[]>
}

export interface TrackpointRepository {
  insertTrackpoints(activityId: string, points: TrackPoint[]): Promise<void>
  getTrackpoints(activityId: string): Promise<TrackPoint[]>
  getTrackpointsSampled(activityId: string, sampleRate: number): Promise<TrackPoint[]>
}
