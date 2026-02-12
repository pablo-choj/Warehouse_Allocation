import { useCallback, useEffect, useMemo, useState } from 'react'
import type React from 'react'

export type UploadDropzoneProps = {
  onFiles: (files: FileList) => void
  accept?: string
  busy?: boolean
}

export function UploadDropzone({ onFiles, accept, busy }: UploadDropzoneProps) {
  const [isDragging, setDragging] = useState(false)
  const [phaseIndex, setPhaseIndex] = useState(0)

  const phases = useMemo(
    () => [
      'Parsing spreadsheet',
      'Normalizing SAP columns',
      'Applying business filters',
      'Running validation rules',
    ],
    [],
  )

  useEffect(() => {
    if (!busy) {
      setPhaseIndex(0)
      return
    }

    const id = window.setInterval(() => {
      setPhaseIndex((p) => (p + 1) % phases.length)
    }, 650)

    return () => window.clearInterval(id)
  }, [busy, phases.length])

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
      className={
        [
          'dropzone',
          isDragging ? 'dropzone--active' : null,
          busy ? 'dropzone--busy' : null,
        ]
          .filter(Boolean)
          .join(' ')
      }
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
        <div className="dropzone__status" aria-live="polite">
          <p className="muted dropzone__statusTitle">
            <span className="spinner" aria-hidden="true" />
            Orchestrating intake pipeline
            <span className="dots" aria-hidden="true">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </p>
          <p className="muted dropzone__statusPhase">{phases[phaseIndex]}</p>
        </div>
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
