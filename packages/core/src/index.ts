// Domain
export type { TrackPoint } from './domain/trackpoint.js'
export type { Trail, TrailDay, Activity, SourceFormat } from './domain/trail.js'
export type { TrackStats } from './domain/track-stats.js'
export { haversineDistance, computeStats, aggregateStats } from './domain/track-stats.js'
export { validateActivityTimestamps } from './domain/activity-validator.js'
export { simplifyTrack } from './domain/track-simplifier.js'
export { downsampleForChart } from './domain/track-downsampler.js'

// Application
export type { FileParser, ParsedActivity, TrailDto, TrailDayDto, ActivityDto, TrailRepository, TrailDayRepository, ActivityRepository, TrackpointRepository } from './application/ports.js'

// Infrastructure
export { GpxParser } from './infrastructure/gpx-parser.js'
export { FitParser } from './infrastructure/fit-parser.js'
