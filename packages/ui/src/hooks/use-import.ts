import { useState } from 'react'
import { computeStats, validateActivityTimestamps } from '@traildiary/core'
import type { FileParser } from '@traildiary/core'
import { useRepositories } from '../contexts/repository-context.js'

export interface FileData {
  name: string
  data: ArrayBuffer
}

export interface ImportProgress {
  status: 'idle' | 'parsing' | 'saving' | 'done' | 'error'
  current: number
  total: number
  message: string
}

export function useImport(parsers: FileParser[]) {
  const repos = useRepositories()
  const [progress, setProgress] = useState<ImportProgress>({
    status: 'idle', current: 0, total: 0, message: '',
  })

  async function importFiles(trailName: string, files: FileData[]): Promise<string | null> {
    const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name))
    setProgress({ status: 'parsing', current: 0, total: sorted.length, message: 'Starting...' })

    const trailId = await repos.trails.createTrail(trailName)

    for (let i = 0; i < sorted.length; i++) {
      const file = sorted[i]
      setProgress({ status: 'parsing', current: i + 1, total: sorted.length, message: `Parsing ${file.name}` })

      const parser = parsers.find((p) => p.canParse(file.name))
      if (!parser) continue

      let dayCreated = false
      let dayId = ''
      let sortOrder = 0

      for await (const activity of parser.parse(file.data, file.name)) {
        if (!validateActivityTimestamps(activity.points)) continue

        if (!dayCreated) {
          setProgress({ status: 'saving', current: i + 1, total: sorted.length, message: `Saving ${file.name}` })
          dayId = await repos.trailDays.createTrailDay(
            trailId, file.name.replace(/\.(gpx|fit)$/i, ''), i + 1
          )
          dayCreated = true
        }

        const stats = computeStats(activity.points)
        const activityId = await repos.activities.createActivity(
          dayId, activity.name, activity.sourceFormat, stats, ++sortOrder
        )
        await repos.trackpoints.insertTrackpoints(activityId, dayId, activity.points)
      }
    }

    setProgress({ status: 'done', current: sorted.length, total: sorted.length, message: 'Done!' })
    return trailId
  }

  return { importFiles, progress }
}
