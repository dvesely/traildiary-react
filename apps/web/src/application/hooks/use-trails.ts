import { useEffect, useState } from 'react'
import type { TrailSummaryDto } from '@traildiary/core'
import { useDb } from '../providers/db-provider.js'
import { createRepositories } from '../../infrastructure/di.js'

export function useTrails() {
  const db = useDb()
  const [trails, setTrails] = useState<TrailSummaryDto[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const repos = createRepositories(db)
      const summaries = await repos.trails.listTrailSummaries()
      if (!cancelled) {
        setTrails(summaries)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [db])

  async function deleteTrail(id: string) {
    const repos = createRepositories(db)
    await repos.trails.deleteTrail(id)
    setTrails((prev) => prev.filter((t) => t.id !== id))
  }

  return { trails, loading, deleteTrail }
}
