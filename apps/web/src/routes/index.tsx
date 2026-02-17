import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { FileDropZone } from '../ui/components/file-drop-zone.js'
import { useImport } from '../application/hooks/use-import.js'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const { importFiles, progress } = useImport()
  const [files, setFiles] = useState<File[]>([])
  const [trailName, setTrailName] = useState('')

  const handleFiles = (newFiles: File[]) => {
    setFiles(newFiles)
    if (!trailName) {
      const prefix = newFiles[0]?.name.replace(/[_\s]\d+.*$/, '') ?? 'My Trail'
      setTrailName(prefix)
    }
  }

  const handleImport = () => {
    if (files.length === 0 || !trailName) return
    importFiles(trailName, files)
  }

  const isImporting = progress.status === 'parsing' || progress.status === 'saving'

  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-full max-w-lg flex flex-col gap-6 p-8">
        <FileDropZone onFiles={handleFiles} disabled={isImporting} />

        {files.length > 0 && (
          <div className="flex flex-col gap-4">
            <input
              type="text"
              value={trailName}
              onChange={(e) => setTrailName(e.target.value)}
              placeholder="Trail name"
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100"
            />
            <p className="text-sm text-gray-400">{files.length} file(s) selected</p>
            <button
              onClick={handleImport}
              disabled={isImporting}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 rounded-lg font-medium transition-colors"
            >
              {isImporting ? `${progress.message} (${progress.current}/${progress.total})` : 'Import'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
