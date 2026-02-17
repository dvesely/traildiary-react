import { useEffect, useState } from 'react'
import { simplifyTrack, aggregateStats, type TrackPoint, type TrackStats } from '@traildiary/core'
import { useDb } from '../providers/db-provider.js'
import { createRepositories } from '../../infrastructure/di.js'

export interface TrailDayView {
  id: string
  name: string
  dayNumber: number
  activities: Array<{
    id: string
    name: string
    stats: TrackStats
    simplifiedPoints: TrackPoint[]
  }>
  stats: TrackStats
}

export interface TrailView {
  id: string
  name: string
  days: TrailDayView[]
  stats: TrackStats
}

export function useTrail(trailId: string) {
  const db = useDb()
  const [trail, setTrail] = useState<TrailView | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const repos = createRepositories(db)
      const trailData = await repos.trails.getTrail(trailId)
      if (!trailData || cancelled) return

      const trailDays = await repos.trailDays.getTrailDays(trailId)
      const days: TrailDayView[] = []

      for (const day of trailDays) {
        const activities = await repos.activities.getActivities(day.id)
        const activityViews = []

        for (const act of activities) {
          const points = await repos.trackpoints.getTrackpointsSampled(act.id, 5)
          const simplified = simplifyTrack(points, 0.0001)
          activityViews.push({
            id: act.id,
            name: act.name,
            stats: act.stats,
            simplifiedPoints: simplified,
          })
        }

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
  }, [trailId, db])

  return { trail, loading }
}
