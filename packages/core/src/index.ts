// Domain

// Application
export type {
  ActivityDto,
  ActivityRepository,
  FileParser,
  Logger,
  LoggerOptions,
  LogLevel,
  ParsedActivity,
  TrackpointRepository,
  TrailDayDto,
  TrailDayRepository,
  TrailDto,
  TrailRepository,
  TrailSummaryDto,
} from './application/ports.js'
export { validateActivityTimestamps } from './domain/activity-validator.js'
export { findNearestPoint } from './domain/find-nearest-point.js'
export { downsampleForChart } from './domain/track-downsampler.js'
export { simplifyTrack } from './domain/track-simplifier.js'
export type { TrackStats } from './domain/track-stats.js'
export {
  aggregateStats,
  computeStats,
  haversineDistance,
} from './domain/track-stats.js'
export type { TrackPoint } from './domain/trackpoint.js'
export type { Activity, SourceFormat, Trail, TrailDay } from './domain/trail.js'
export {
  simplifyPointsForZoom,
  toleranceForZoom,
} from './domain/zoom-simplifier.js'
export { FitParser } from './infrastructure/fit-parser.js'
// Infrastructure
export { GpxParser } from './infrastructure/gpx-parser.js'
export { sleep } from './utils/sleep.js'
