import type { Transcript } from '@earmark/core'
import { formatTimestamp } from '../formatTimestamp'

interface TranscriptViewProps {
  readonly transcript: Transcript
  readonly onSeek: (ms: number) => void
}

export const TranscriptView = ({ transcript, onSeek }: TranscriptViewProps) => (
  <section className="transcript" aria-label="Transcript">
    <p className="transcript__meta">
      {transcript.provider} · {transcript.model} · {transcript.language}
    </p>
    <ol>
      {transcript.segments.map((segment) => (
        <li key={`${segment.startMs}-${segment.endMs}`}>
          <button
            type="button"
            className="transcript__segment"
            onClick={() => onSeek(segment.startMs)}
            aria-label={`Play from ${formatTimestamp(segment.startMs)}`}
          >
            <time>{formatTimestamp(segment.startMs)}</time>
            <span>{segment.text}</span>
          </button>
        </li>
      ))}
    </ol>
  </section>
)
