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

export type { Trail, TrailDay, Activity } from './models.js'
export type { TrailRepository, TrailDayRepository, ActivityRepository, TrackpointRepository } from './repositories.js'
