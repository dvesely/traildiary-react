import { useCallback, useState, type DragEvent } from 'react'

interface FileDropZoneProps {
  onFiles: (files: File[]) => void
  disabled?: boolean
}

export function FileDropZone({ onFiles, disabled }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDrag = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragIn = useCallback((e: DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragOut = useCallback((e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (disabled) return
      const files = Array.from(e.dataTransfer.files).filter(
        (f) => f.name.toLowerCase().endsWith('.gpx') || f.name.toLowerCase().endsWith('.fit')
      )
      if (files.length > 0) onFiles(files)
    },
    [onFiles, disabled]
  )

  const handleClick = useCallback(() => {
    if (disabled) return
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = '.gpx,.fit'
    input.onchange = () => {
      const files = Array.from(input.files ?? [])
      if (files.length > 0) onFiles(files)
    }
    input.click()
  }, [onFiles, disabled])

  return (
    <div
      onDragOver={handleDrag}
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`
        flex flex-col items-center justify-center gap-4 p-12
        border-2 border-dashed rounded-xl cursor-pointer transition-colors
        ${isDragging ? 'border-blue-400 bg-blue-400/10' : 'border-gray-600 hover:border-gray-400'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <p className="text-lg text-gray-300">Drop GPX/FIT files here</p>
      <p className="text-sm text-gray-500">or click to browse</p>
    </div>
  )
}
