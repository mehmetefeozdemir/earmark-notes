import { formatTimestamp } from '../formatTimestamp'
import type { RecorderStatus } from '../useRecorder'

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
