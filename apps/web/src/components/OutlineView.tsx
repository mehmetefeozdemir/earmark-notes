import type { Outline, Transcript } from '@earmark/core'
import { formatTimestamp } from '../formatTimestamp'

interface OutlineViewProps {
  readonly outline: Outline
  readonly transcript: Transcript
  readonly onSeek: (ms: number) => void
}

export const OutlineView = ({ outline, transcript, onSeek }: OutlineViewProps) => (
  <section className="study-aid" aria-label="Outline">
    <h3>Outline</h3>
    <ol className="outline">
      {outline.sections.map((section) => {
        const startMs = transcript.segments[section.startSegmentIndex]?.startMs ?? 0
        return (
          <li key={section.startSegmentIndex}>
            <button
              type="button"
              className="outline__section"
              onClick={() => onSeek(startMs)}
              aria-label={`Play section "${section.title}" from ${formatTimestamp(startMs)}`}
            >
              <time>{formatTimestamp(startMs)}</time>
              <span>
                <strong>{section.title}</strong>
                {section.summary && <span className="outline__summary">{section.summary}</span>}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  </section>
)
