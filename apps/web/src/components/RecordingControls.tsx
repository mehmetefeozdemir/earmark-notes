import { formatTimestamp } from '../formatTimestamp'
import type { RecorderStatus } from '../useRecorder'

/**
 * The clock shows the session timeline (recordings laid end to end), so when idle it is
 * the total recorded so far, not a running timer. The label makes that explicit.
 */
const CLOCK_LABELS: Readonly<Record<RecorderStatus, string>> = {
  idle: 'Total recorded',
  starting: 'Starting',
  recording: 'Recording',
  paused: 'Paused',
  stopping: 'Saving',
}

interface RecordingControlsProps {
  readonly status: RecorderStatus
  readonly timelineMs: number
  readonly onStart: () => void
  readonly onPause: () => void
  readonly onResume: () => void
  readonly onStop: () => void
}

export const RecordingControls = ({
  status,
  timelineMs,
  onStart,
  onPause,
  onResume,
  onStop,
}: RecordingControlsProps) => {
  const isActive = status === 'recording' || status === 'paused'
  return (
    <div className="recording-controls" role="group" aria-label="Recording controls">
      <span
        className={`recording-controls__dot recording-controls__dot--${status}`}
        aria-hidden="true"
      />
      <span className="recording-controls__label">{CLOCK_LABELS[status]}</span>
      <time className="recording-controls__clock">{formatTimestamp(timelineMs)}</time>
      {status === 'idle' && (
        <button type="button" onClick={onStart}>
          Record
        </button>
      )}
      {status === 'recording' && (
        <button type="button" onClick={onPause}>
          Pause
        </button>
      )}
      {status === 'paused' && (
        <button type="button" onClick={onResume}>
          Resume
        </button>
      )}
      {isActive && (
        <button type="button" onClick={onStop}>
          Stop
        </button>
      )}
      {(status === 'starting' || status === 'stopping') && (
        <span role="status">{status === 'starting' ? 'Starting…' : 'Saving…'}</span>
      )}
    </div>
  )
}
