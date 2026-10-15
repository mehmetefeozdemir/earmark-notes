import type { Recording } from '@earmark/core'
import { useEffect, useState } from 'react'
import { formatTimestamp } from '../formatTimestamp'
import { services } from '../services'

const RecordingPlayer = ({ recording }: { readonly recording: Recording }) => {
  const [url, setUrl] = useState<string>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    let objectUrl: string | undefined
    let cancelled = false
    services.chunks.read(recording.id, recording.mimeType).then(
      (blob) => {
        if (cancelled) return
        if (blob.size === 0) {
          setError('Audio is not available on this device.')
          return
        }
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      },
      () => !cancelled && setError('Could not load this recording.'),
    )
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [recording.id, recording.mimeType])

  if (error) return <p role="alert">{error}</p>
  if (!url) return <p>Loading audio…</p>
  return <audio controls preload="metadata" src={url} />
}

interface RecordingListProps {
  readonly recordings: readonly Recording[]
}

export const RecordingList = ({ recordings }: RecordingListProps) => {
  if (recordings.length === 0) return null
  return (
    <section aria-label="Recordings" className="recordings">
      <h2>Recordings</h2>
      <ul>
        {recordings.map((recording, position) => (
          <li key={recording.id}>
            <span>
              #{position + 1} · {formatTimestamp(recording.durationMs)} · {recording.chunks.length}{' '}
              chunks
            </span>
            <RecordingPlayer recording={recording} />
          </li>
        ))}
      </ul>
    </section>
  )
}
