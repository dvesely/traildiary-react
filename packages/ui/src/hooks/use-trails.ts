import { useEffect, useState } from 'react'
import type { TrailSummaryDto } from '@traildiary/core'
import { useRepositories } from '../contexts/repository-context.js'

export function useTrails() {
  const repos = useRepositories()
  const [trails, setTrails] = useState<TrailSummaryDto[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    repos.trails.listTrailSummaries().then((summaries) => {
      if (!cancelled) {
        setTrails(summaries)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [repos])

  async function deleteTrail(id: string) {
    await repos.trails.deleteTrail(id)
    setTrails((prev) => prev.filter((t) => t.id !== id))
  }

  return { trails, loading, deleteTrail }
}
