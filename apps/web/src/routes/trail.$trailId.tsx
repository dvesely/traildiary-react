import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useTrail } from '../application/hooks/use-trail.js'
import { useElevationData } from '../application/hooks/use-activity.js'
import { MapView } from '../ui/components/map-view.js'
import { DaySidebar } from '../ui/components/day-sidebar.js'
import { ElevationChart } from '../ui/components/elevation-chart.js'
import { StatsPanel } from '../ui/components/stats-panel.js'

export const Route = createFileRoute('/trail/$trailId')({
  component: TrailPage,
})

function TrailPage() {
  const { trailId } = Route.useParams()
  const { trail, loading } = useTrail(trailId)
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null)
  const { chartPoints } = useElevationData(trail, selectedDayId)

  if (loading || !trail) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400">Loading trail...</p>
      </div>
    )
  }

  const selectedDay = selectedDayId ? trail.days.find((d) => d.id === selectedDayId) : null
  const currentStats = selectedDay ? selectedDay.stats : trail.stats
  const currentLabel = selectedDay ? selectedDay.name : 'Trail total'

  return (
    <div className="flex h-full">
      <DaySidebar trail={trail} selectedDayId={selectedDayId} onSelectDay={setSelectedDayId} />
      <div className="flex-1 flex flex-col">
        <div className="flex-1">
          <MapView days={trail.days} selectedDayId={selectedDayId} />
        </div>
        <div className="border-t border-gray-800 p-2">
          <ElevationChart points={chartPoints} height={176} />
        </div>
        <div className="border-t border-gray-800">
          <StatsPanel stats={currentStats} label={currentLabel} />
        </div>
      </div>
    </div>
  )
}
