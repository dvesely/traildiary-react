import { useEffect, useState } from 'react'
import { downsampleForChart, type TrackPoint } from '@traildiary/core'
import { useDb } from '../providers/db-provider.js'
import { createRepositories } from '../../infrastructure/di.js'
import type { TrailView } from './use-trail.js'

export function useElevationData(trail: TrailView | null, selectedDayId: string | null) {
  const db = useDb()
  const [chartPoints, setChartPoints] = useState<TrackPoint[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!trail) return
    let cancelled = false
    setLoading(true)

    async function load() {
      const repos = createRepositories(db)
      const allPoints: TrackPoint[] = []

      const days = selectedDayId
        ? trail!.days.filter((d) => d.id === selectedDayId)
        : trail!.days

      for (const day of days) {
        for (const act of day.activities) {
          const points = await repos.trackpoints.getTrackpointsSampled(act.id, 3)
          allPoints.push(...points)
        }
      }

      if (!cancelled) {
        setChartPoints(downsampleForChart(allPoints, 2000))
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [trail, selectedDayId, db])

  return { chartPoints, loading }
}
