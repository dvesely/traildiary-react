import { useNavigate } from '@tanstack/react-router'
import { GpxParser, FitParser } from '@traildiary/core'
import { useImport as useSharedImport } from '@traildiary/ui'

const parsers = [new GpxParser(), new FitParser()]

export function useImport() {
  const navigate = useNavigate()
  const { importFiles: importFilesShared, progress } = useSharedImport(parsers)

  async function importFiles(trailName: string, files: File[]) {
    const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name))
    const filesData = await Promise.all(
      sorted.map(async (f) => ({ name: f.name, data: await f.arrayBuffer() }))
    )
    const trailId = await importFilesShared(trailName, filesData)
    if (trailId) navigate({ to: '/trail/$trailId', params: { trailId } })
  }

  return { importFiles, progress }
}
