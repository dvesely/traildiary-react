import { useState } from 'react'
import { useDb } from '../providers/db-provider.js'
import { createRepositories } from '../../infrastructure/di.js'


export function useRemoveDay() {
  const db = useDb()

  async function removeDay(trailDayId: string) {
      const repos = createRepositories(db);

      await repos.trailDays.deleteTrailDay(trailDayId);
  }

  return { removeDay }
}
