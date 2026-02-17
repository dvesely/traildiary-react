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
