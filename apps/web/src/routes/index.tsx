import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-gray-400">Drop GPX/FIT files here to get started</p>
    </div>
  )
}
