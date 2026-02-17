import type { TrackStats } from '@traildiary/core'

interface StatsPanelProps {
  stats: TrackStats
  label: string
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3_600_000)
  const minutes = Math.floor((ms % 3_600_000) / 60_000)
  return `${hours}h ${minutes}m`
}

export function StatsPanel({ stats, label }: StatsPanelProps) {
  return (
    <div className="flex items-center gap-6 px-4 py-2 text-sm">
      <span className="font-medium text-gray-300">{label}</span>
      <span className="text-gray-400">
        {stats.distance.toFixed(1)} km
      </span>
      <span className="text-green-400">
        +{Math.round(stats.elevationGain)} m
      </span>
      <span className="text-red-400">
        -{Math.round(stats.elevationLoss)} m
      </span>
      <span className="text-gray-400">
        {formatDuration(stats.duration)}
      </span>
      <span className="text-gray-400">
        Moving: {formatDuration(stats.movingTime)}
      </span>
      <span className="text-gray-400">
        {stats.avgSpeed.toFixed(1)} km/h avg
      </span>
    </div>
  )
}
