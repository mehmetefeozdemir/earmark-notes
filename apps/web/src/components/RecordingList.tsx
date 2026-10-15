import type { Recording } from '@earmark/core'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { fixMediaDuration } from '../fixMediaDuration'
import { formatTimestamp } from '../formatTimestamp'
import { services } from '../services'
import type { TranscriptionStatus } from '../useTranscription'
import { TranscriptView } from './TranscriptView'

const MS_PER_SECOND = 1_000

interface RecordingPlayerProps {
  readonly recording: Recording
  readonly audioRef: RefObject<HTMLAudioElement | null>
}

const RecordingPlayer = ({ recording, audioRef }: RecordingPlayerProps) => {
  const [url, setUrl] = useState<string>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    const audio = audioRef.current
    return audio ? fixMediaDuration(audio) : undefined
  }, [url, audioRef])

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
  return <audio ref={audioRef} controls preload="metadata" src={url} />
}

interface RecordingItemProps {
  readonly recording: Recording
  readonly position: number
  readonly status: TranscriptionStatus | undefined
  readonly onTranscribe: (recording: Recording) => void
}

const RecordingItem = ({ recording, position, status, onTranscribe }: RecordingItemProps) => {
  const audioRef = useRef<HTMLAudioElement>(null)
  const isBusy = status?.busy ?? false

  const seek = (ms: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = ms / MS_PER_SECOND
    void audio.play()
  }

  return (
    <li>
      <div className="recording__header">
        <span>
          #{position + 1} · {formatTimestamp(recording.durationMs)}
        </span>
        <button type="button" disabled={isBusy} onClick={() => onTranscribe(recording)}>
          {isBusy ? 'Transcribing…' : recording.transcript ? 'Transcribe again' : 'Transcribe'}
        </button>
      </div>
      <RecordingPlayer recording={recording} audioRef={audioRef} />
      {status?.error && <p role="alert">{status.error}</p>}
      {recording.transcript && <TranscriptView transcript={recording.transcript} onSeek={seek} />}
    </li>
  )
}

interface RecordingListProps {
  readonly recordings: readonly Recording[]
  readonly statuses: Readonly<Record<string, TranscriptionStatus>>
  readonly onTranscribe: (recording: Recording) => void
}

export const RecordingList = ({ recordings, statuses, onTranscribe }: RecordingListProps) => {
  if (recordings.length === 0) return null
  return (
    <section aria-label="Recordings" className="recordings">
      <h2>Recordings</h2>
      <ul>
        {recordings.map((recording, position) => (
          <RecordingItem
            key={recording.id}
            recording={recording}
            position={position}
            status={statuses[recording.id]}
            onTranscribe={onTranscribe}
          />
        ))}
      </ul>
    </section>
  )
}
