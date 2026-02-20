import { useCallback, useEffect, useState } from 'react'
import { simplifyTrack, aggregateStats } from '@traildiary/core'
import { useRepositories } from '../contexts/repository-context.js'
import type { TrailView, TrailDayView } from '../types/trail-view.js'

export function useTrail(trailId: string) {
  const repos = useRepositories()
  const [trail, setTrail] = useState<TrailView | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      const trailData = await repos.trails.getTrail(trailId)
      if (!trailData || cancelled) return

      const trailDays = await repos.trailDays.getTrailDays(trailId)
      const days: TrailDayView[] = []

      for (const day of trailDays) {
        const activities = await repos.activities.getActivities(day.id)
        const activityViews = await Promise.all(
          activities.map(async (act) => {
            const points = await repos.trackpoints.getTrackpointsSampled(act.id, 5)
            return {
              id: act.id,
              name: act.name,
              stats: act.stats,
              simplifiedPoints: simplifyTrack(points, 0.0001),
            }
          })
        )
        days.push({
          id: day.id,
          name: day.name,
          dayNumber: day.dayNumber,
          activities: activityViews,
          stats: aggregateStats(activityViews.map((a) => a.stats)),
        })
      }

      if (!cancelled) {
        setTrail({
          id: trailId,
          name: trailData.name,
          days,
          stats: aggregateStats(days.map((d) => d.stats)),
        })
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [trailId, repos, refreshKey])

  return { trail, loading, refresh }
}
