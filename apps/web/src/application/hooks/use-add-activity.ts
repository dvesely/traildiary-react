import { useState } from 'react'
import { GpxParser, FitParser, computeStats, validateActivityTimestamps } from '@traildiary/core'
import { useDb } from '../providers/db-provider.js'
import { createRepositories } from '../../infrastructure/di.js'

interface AddActivityProgress {
  status: 'idle' | 'parsing' | 'saving' | 'done' | 'error'
  current: number
  total: number
  message: string
  warnings: string[]
}

const parsers = [new GpxParser(), new FitParser()]

export function useAddActivity(trailId: string) {
  const db = useDb()
  const [progress, setProgress] = useState<AddActivityProgress>({
    status: 'idle', current: 0, total: 0, message: '', warnings: [],
  })

  async function addFiles(files: File[]) {
    const repos = createRepositories(db)
    const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name))
    const warnings: string[] = []

    setProgress({ status: 'parsing', current: 0, total: sorted.length, message: 'Starting...', warnings })

    const existingDays = await repos.trailDays.getTrailDays(trailId)
    let nextDayNumber = existingDays.length > 0
      ? Math.max(...existingDays.map((d) => d.dayNumber)) + 1
      : 1

    for (let i = 0; i < sorted.length; i++) {
      const file = sorted[i]
      setProgress({ status: 'parsing', current: i + 1, total: sorted.length, message: `Parsing ${file.name}`, warnings })

      const parser = parsers.find((p) => p.canParse(file.name))
      if (!parser) {
        warnings.push(`${file.name}: unsupported format`)
        continue
      }

      const buffer = await file.arrayBuffer()
      const activities = await parser.parse(buffer, file.name)
      const validActivities = activities.filter((a) => validateActivityTimestamps(a.points))

      if (validActivities.length < activities.length) {
        const skipped = activities.length - validActivities.length
        warnings.push(`${file.name}: skipped ${skipped} activity(ies) without timestamps`)
      }

      if (validActivities.length === 0) {
        warnings.push(`${file.name}: no valid activities`)
        continue
      }

      setProgress({ status: 'saving', current: i + 1, total: sorted.length, message: `Saving ${file.name}`, warnings })

      const dayId = await repos.trailDays.createTrailDay(trailId, file.name.replace(/\.(gpx|fit)$/i, ''), nextDayNumber++)

      for (let j = 0; j < validActivities.length; j++) {
        const activity = validActivities[j]
        const stats = computeStats(activity.points)
        const activityId = await repos.activities.createActivity(
          dayId, activity.name, activity.sourceFormat, stats, j + 1
        )
        await repos.trackpoints.insertTrackpoints(activityId, activity.points)
      }
    }

    setProgress({ status: 'done', current: sorted.length, total: sorted.length, message: 'Done!', warnings })
  }

  return { addFiles, progress }
}
