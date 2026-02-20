import { GpxParser, FitParser } from '@traildiary/core'
import { useAddActivity as useSharedAddActivity } from '@traildiary/ui'

const parsers = [new GpxParser(), new FitParser()]

export function useAddActivity(trailId: string) {
  const { addFiles: addFilesShared, progress } = useSharedAddActivity(trailId, parsers)

  async function addFiles(files: File[]) {
    const filesData = await Promise.all(
      files.map(async (f) => ({ name: f.name, data: await f.arrayBuffer() }))
    )
    await addFilesShared(filesData)
  }

  return { addFiles, progress }
}
