import type { TrailView } from '../../application/hooks/use-trail.js'

interface DaySidebarProps {
  trail: TrailView
  selectedDayId: string | null
  onSelectDay: (dayId: string | null) => void
}

function formatDistance(km: number): string {
  return `${km.toFixed(1)} km`
}

function formatElevation(m: number): string {
  return `${Math.round(m)} m`
}

export function DaySidebar({ trail, selectedDayId, onSelectDay }: DaySidebarProps) {
  return (
    <div className="w-64 h-full overflow-y-auto border-r border-gray-800 flex flex-col">
      <button
        onClick={() => onSelectDay(null)}
        className={`p-3 text-left border-b border-gray-800 transition-colors ${
          selectedDayId === null ? 'bg-gray-800' : 'hover:bg-gray-900'
        }`}
      >
        <div className="font-medium">Trail total</div>
        <div className="text-sm text-gray-400">
          {formatDistance(trail.stats.distance)} | +{formatElevation(trail.stats.elevationGain)}
        </div>
      </button>

      {trail.days.map((day) => (
        <button
          key={day.id}
          onClick={() => onSelectDay(day.id)}
          className={`p-3 text-left border-b border-gray-800 transition-colors ${
            selectedDayId === day.id ? 'bg-gray-800' : 'hover:bg-gray-900'
          }`}
        >
          <div className="font-medium text-sm">{day.name}</div>
          <div className="text-xs text-gray-400">
            {formatDistance(day.stats.distance)} | +{formatElevation(day.stats.elevationGain)}
          </div>
        </button>
      ))}
    </div>
  )
}
