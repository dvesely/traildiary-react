import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { GpxParser, FitParser, computeStats, validateActivityTimestamps } from '@traildiary/core'
import { useDb } from '../providers/db-provider.js'
import { createRepositories } from '../../infrastructure/di.js'

interface ImportProgress {
  status: 'idle' | 'parsing' | 'saving' | 'done' | 'error'
  current: number
  total: number
  message: string
}

const parsers = [new GpxParser(), new FitParser()]

export function useImport() {
  const db = useDb()
  const navigate = useNavigate()
  const [progress, setProgress] = useState<ImportProgress>({
    status: 'idle', current: 0, total: 0, message: '',
  })

  async function importFiles(trailName: string, files: File[]) {
    const repos = createRepositories(db)
    const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name))

    setProgress({ status: 'parsing', current: 0, total: sorted.length, message: 'Starting...' })

    const trailId = await repos.trails.createTrail(trailName)

    for (let i = 0; i < sorted.length; i++) {
      const file = sorted[i]
      setProgress({ status: 'parsing', current: i + 1, total: sorted.length, message: `Parsing ${file.name}` })

      const parser = parsers.find((p) => p.canParse(file.name))
      if (!parser) continue

      const buffer = await file.arrayBuffer()
      const activities = await parser.parse(buffer, file.name)
      const validActivities = activities.filter((a) => validateActivityTimestamps(a.points))

      if (validActivities.length < activities.length) {
        const skipped = activities.length - validActivities.length
        setProgress({ status: 'parsing', current: i + 1, total: sorted.length, message: `${file.name}: skipped ${skipped} activity(ies) without timestamps` })
      }

      if (validActivities.length === 0) continue

      setProgress({ status: 'saving', current: i + 1, total: sorted.length, message: `Saving ${file.name}` })

      const dayId = await repos.trailDays.createTrailDay(trailId, file.name.replace(/\.(gpx|fit)$/i, ''), i + 1)

      for (let j = 0; j < validActivities.length; j++) {
        const activity = validActivities[j]
        const stats = computeStats(activity.points)
        const activityId = await repos.activities.createActivity(
          dayId, activity.name, activity.sourceFormat, stats, j + 1
        )
        await repos.trackpoints.insertTrackpoints(activityId, activity.points)
      }
    }

    setProgress({ status: 'done', current: sorted.length, total: sorted.length, message: 'Done!' })
    navigate({ to: '/trail/$trailId', params: { trailId } })
  }

  return { importFiles, progress }
}
