import type { SessionSummary } from '@earmark/storage'

interface SessionPickerProps {
  readonly currentId: string
  readonly summaries: readonly SessionSummary[]
  /** True while recording: switching lecture mid-recording would misfile the audio. */
  readonly isLocked: boolean
  readonly onOpen: (id: string) => void
  readonly onNew: () => void
}

export const SessionPicker = ({
  currentId,
  summaries,
  isLocked,
  onOpen,
  onNew,
}: SessionPickerProps) => (
  <div className="session-picker">
    <select
      aria-label="Open lecture"
      value={currentId}
      disabled={isLocked}
      onChange={(event) => onOpen(event.target.value)}
    >
      {summaries.map((summary) => (
        <option key={summary.id} value={summary.id}>
          {summary.title} ({summary.noteCount} {summary.noteCount === 1 ? 'note' : 'notes'})
        </option>
      ))}
    </select>
    <button type="button" disabled={isLocked} onClick={onNew}>
      New lecture
    </button>
    {isLocked && <span className="session-picker__hint">Stop recording to switch lectures.</span>}
  </div>
)
