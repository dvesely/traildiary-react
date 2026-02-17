import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useTrail } from '../application/hooks/use-trail.js'
import { MapView } from '../ui/components/map-view.js'
import { DaySidebar } from '../ui/components/day-sidebar.js'

export const Route = createFileRoute('/trail/$trailId')({
  component: TrailPage,
})

function TrailPage() {
  const { trailId } = Route.useParams()
  const { trail, loading } = useTrail(trailId)
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null)

  if (loading || !trail) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400">Loading trail...</p>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <DaySidebar trail={trail} selectedDayId={selectedDayId} onSelectDay={setSelectedDayId} />
      <div className="flex-1 flex flex-col">
        <div className="flex-1">
          <MapView days={trail.days} selectedDayId={selectedDayId} />
        </div>
      </div>
    </div>
  )
}
