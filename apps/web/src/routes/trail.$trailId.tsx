import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/trail/$trailId')({
  component: TrailPage,
})

function TrailPage() {
  const { trailId } = Route.useParams()
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-gray-400">Trail: {trailId}</p>
    </div>
  )
}
