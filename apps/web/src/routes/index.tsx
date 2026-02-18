import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useTrails } from '../application/hooks/use-trails.js'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const { trails, loading, deleteTrail } = useTrails()
  const [confirmId, setConfirmId] = useState<string | null>(null)

  function handleDeleteClick(e: React.MouseEvent, id: string) {
    e.preventDefault()
    if (confirmId === id) {
      deleteTrail(id)
      setConfirmId(null)
    } else {
      setConfirmId(id)
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">My Trails</h2>
          <Link
            to="/import"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
          >
            New Trail
          </Link>
        </div>

        {loading && (
          <p className="text-gray-400 text-sm">Loading…</p>
        )}

        {!loading && trails.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <p className="text-gray-400">No trails yet.</p>
            <Link
              to="/import"
              className="text-blue-400 hover:text-blue-300 underline text-sm"
            >
              Import your first trail
            </Link>
          </div>
        )}

        {!loading && trails.length > 0 && (
          <ul className="flex flex-col gap-3">
            {trails.map((trail) => (
              <li key={trail.id} className="flex items-stretch gap-2">
                <Link
                  to="/trail/$trailId"
                  params={{ trailId: trail.id }}
                  className="flex-1 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-xl px-5 py-4 transition-colors"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-medium text-gray-100 truncate">{trail.name}</span>
                    <span className="text-sm text-gray-400 shrink-0">
                      {trail.totalDistance > 0
                        ? `${trail.totalDistance.toFixed(1)} km`
                        : '—'}
                    </span>
                  </div>
                  {trail.startAt != null && (
                    <p className="mt-1 text-sm text-gray-500">
                      {new Date(trail.startAt).toLocaleDateString(undefined, {
                        year: 'numeric', month: 'short', day: 'numeric',
                      })}
                    </p>
                  )}
                </Link>
                <button
                  onClick={(e) => handleDeleteClick(e, trail.id)}
                  onBlur={() => setConfirmId(null)}
                  className={confirmId === trail.id
                    ? 'px-3 py-2 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-medium transition-colors shrink-0'
                    : 'px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-sm text-gray-400 hover:text-red-400 transition-colors shrink-0'}
                >
                  {confirmId === trail.id ? 'Sure?' : 'Delete'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
