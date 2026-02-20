import { useRepositories } from '../contexts/repository-context.js'

export function useRemoveDay() {
  const repos = useRepositories()

  async function removeDay(trailDayId: string): Promise<void> {
    await repos.trailDays.deleteTrailDay(trailDayId)
  }

  return { removeDay }
}
