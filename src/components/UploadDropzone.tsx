import { useCallback, useState } from 'react'
import type React from 'react'

export type UploadDropzoneProps = {
  onFiles: (files: FileList) => void
  accept?: string
  busy?: boolean
}

export function UploadDropzone({ onFiles, accept, busy }: UploadDropzoneProps) {
  const [isDragging, setDragging] = useState(false)

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      setDragging(false)
      if (event.dataTransfer.files?.length) {
        onFiles(event.dataTransfer.files)
      }
    },
    [onFiles],
  )

  return (
    <div
      className={isDragging ? 'dropzone dropzone--active' : 'dropzone'}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <p className="eyebrow">Upload & Simulate</p>
      <h3>Drag your SAP Excel</h3>
      <p>Formats: .xlsx or paste a small JSON/CSV</p>
      {busy && (
        <p className="muted" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="spinner" aria-hidden="true" />
          Importing and filtering file...
        </p>
      )}
      <label className="dropzone__button">
        {busy ? 'Processing...' : 'Choose file'}
        <input
          type="file"
          accept={accept ?? '.xlsx,.csv,.json'}
          hidden
          disabled={Boolean(busy)}
          onChange={(event) => {
            if (event.target.files?.length) {
              onFiles(event.target.files)
            }
          }}
        />
      </label>
    </div>
  )
}
