import type { TrackPoint } from '../domain/trackpoint.js'
import type { SourceFormat } from '../domain/trail.js'

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error'

export interface LoggerOptions {
  logLevels: LogLevel[]
}

export interface Logger {
  trace(message: string, data?: unknown): void
  debug(message: string, data?: unknown): void
  info(message: string, data?: unknown): void
  warn(message: string, data?: unknown): void
  error(message: string, data?: unknown): void
}

export interface ParsedActivity {
  name: string
  sourceFormat: SourceFormat
  points: TrackPoint[]
}

export interface FileParser {
  canParse(fileName: string): boolean
  parse(data: ArrayBuffer, fileName: string): AsyncGenerator<ParsedActivity>
}

export type { TrailDto, TrailDayDto, ActivityDto, TrailSummaryDto } from './models.js'
export type { TrailRepository, TrailDayRepository, ActivityRepository, TrackpointRepository } from './repositories.js'
