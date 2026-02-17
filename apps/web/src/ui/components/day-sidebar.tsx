import { useRef } from 'react'
import type { TrailView } from '../../application/hooks/use-trail.js'

interface DaySidebarProps {
  trail: TrailView
  selectedDayId: string | null
  onSelectDay: (dayId: string | null) => void
  onAddFiles?: (files: File[]) => void
  onRemoveDay?: (dayId: string) => void
}

function formatDistance(km: number): string {
  return `${km.toFixed(1)} km`
}

function formatElevation(m: number): string {
  return `${Math.round(m)} m`
}

export function DaySidebar({ trail, selectedDayId, onSelectDay, onAddFiles, onRemoveDay }: DaySidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (files && files.length > 0 && onAddFiles) {
      onAddFiles(Array.from(files))
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

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

      {onAddFiles && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".gpx,.fit"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="m-2 px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            + Add Activity
          </button>
        </>
      )}

      {trail.days.map((day) => (
        <div
          key={day.id}
          onClick={() => onSelectDay(day.id)}
          className={`p-3 text-left border-b border-gray-800 transition-colors cursor-pointer flex items-start justify-between ${
            selectedDayId === day.id ? 'bg-gray-800' : 'hover:bg-gray-900'
          }`}
        >
          <div>
            <div className="font-medium text-sm">{day.name}</div>
            <div className="text-xs text-gray-400">
              {formatDistance(day.stats.distance)} | +{formatElevation(day.stats.elevationGain)}
            </div>
          </div>
          {onRemoveDay && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRemoveDay(day.id)
              }}
              className="ml-2 p-1 text-gray-500 hover:text-red-400 transition-colors"
              title="Remove day"
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
