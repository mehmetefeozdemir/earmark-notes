import type { Recording } from '@earmark/core'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { fixMediaDuration } from '../fixMediaDuration'
import { formatTimestamp } from '../formatTimestamp'
import { services } from '../services'
import type { StudyAidKind, StudyAidStatus } from '../useStudyAids'
import type { TranscriptionStatus } from '../useTranscription'
import { OutlineView } from './OutlineView'
import { QuizView } from './QuizView'
import { TranscriptView } from './TranscriptView'

export interface StudyAidControls {
  readonly generate: (recording: Recording, kind: StudyAidKind) => void
  readonly statusFor: (recordingId: string, kind: StudyAidKind) => StudyAidStatus | undefined
}

const STUDY_AID_LABELS: Readonly<Record<StudyAidKind, string>> = {
  outline: 'Outline',
  quiz: 'Quiz',
}

interface StudyAidButtonProps {
  readonly recording: Recording
  readonly kind: StudyAidKind
  readonly controls: StudyAidControls
}

const StudyAidButton = ({ recording, kind, controls }: StudyAidButtonProps) => {
  const isBusy = controls.statusFor(recording.id, kind)?.busy ?? false
  const exists = recording[kind] !== undefined
  const label = STUDY_AID_LABELS[kind]
  return (
    <button type="button" disabled={isBusy} onClick={() => controls.generate(recording, kind)}>
      {isBusy
        ? `Generating ${label.toLowerCase()}…`
        : exists
          ? `New ${label.toLowerCase()}`
          : label}
    </button>
  )
}

const StudyAidMessages = ({ recording, controls }: Omit<StudyAidButtonProps, 'kind'>) => (
  <>
    {(['outline', 'quiz'] as const).map((kind) => {
      const status = controls.statusFor(recording.id, kind)
      return (
        <div key={kind}>
          {status?.error && <p role="alert">{status.error}</p>}
          {status?.notice && <p role="status">{status.notice}</p>}
        </div>
      )
    })}
  </>
)

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
  readonly studyAids: StudyAidControls
}

const RecordingItem = ({
  recording,
  position,
  status,
  onTranscribe,
  studyAids,
}: RecordingItemProps) => {
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
      {recording.transcript && (
        <>
          <div className="study-aid__actions" role="group" aria-label="Study tools">
            <StudyAidButton recording={recording} kind="outline" controls={studyAids} />
            <StudyAidButton recording={recording} kind="quiz" controls={studyAids} />
          </div>
          <StudyAidMessages recording={recording} controls={studyAids} />
          {recording.outline && (
            <OutlineView
              outline={recording.outline}
              transcript={recording.transcript}
              onSeek={seek}
            />
          )}
          {recording.quiz && (
            <QuizView
              key={recording.quiz.createdAt}
              quiz={recording.quiz}
              transcript={recording.transcript}
              onSeek={seek}
            />
          )}
          <details className="transcript-toggle">
            <summary>Transcript</summary>
            <TranscriptView transcript={recording.transcript} onSeek={seek} />
          </details>
        </>
      )}
    </li>
  )
}

interface RecordingListProps {
  readonly recordings: readonly Recording[]
  readonly statuses: Readonly<Record<string, TranscriptionStatus>>
  readonly onTranscribe: (recording: Recording) => void
  readonly studyAids: StudyAidControls
}

export const RecordingList = ({
  recordings,
  statuses,
  onTranscribe,
  studyAids,
}: RecordingListProps) => {
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
            studyAids={studyAids}
          />
        ))}
      </ul>
    </section>
  )
}
