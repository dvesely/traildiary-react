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

export type EnvironmentType = 'development' | 'production' | 'staging' | 'test'

export interface Environment {
  isProduction(): boolean
  isDevelopment(): boolean
  get(): EnvironmentType
}

export type {
  ActivityDto,
  TrailDayDto,
  TrailDto,
  TrailSummaryDto,
} from './models.js'
export type {
  ActivityRepository,
  TrackpointRepository,
  TrailDayRepository,
  TrailRepository,
} from './repositories.js'
