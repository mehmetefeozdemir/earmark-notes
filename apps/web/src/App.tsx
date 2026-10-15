import { addNote, sessionDurationMs, type NoteKind, type Session } from '@earmark/core'
import type { RecoveryReport } from '@earmark/storage'
import { Banner } from './components/Banner'
import { NoteComposer } from './components/NoteComposer'
import { NoteList } from './components/NoteList'
import { RecordingControls } from './components/RecordingControls'
import { RecordingList } from './components/RecordingList'
import { services } from './services'
import { useRecorder } from './useRecorder'
import { useSessionStore } from './useSessionStore'
import { useStopwatch } from './useStopwatch'

const recoveryMessage = ({ recovered, corruptIds }: RecoveryReport): string | undefined => {
  const parts = [
    recovered.length > 0 &&
      `Recovered ${recovered.length} recording${recovered.length === 1 ? '' : 's'} interrupted by a closed tab or crash.`,
    corruptIds.length > 0 && `${corruptIds.length} unreadable recording draft(s) were kept aside.`,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : undefined
}

interface SessionViewProps {
  readonly session: Session
  readonly mutate: (change: (session: Session) => Session) => Promise<void>
  readonly runAndReload: <T>(task: () => Promise<T>) => Promise<T>
}

const SessionView = ({ session, mutate, runAndReload }: SessionViewProps) => {
  const recorder = useRecorder({ runAndReload })
  const stopwatch = useStopwatch()
  // Recordings are laid end to end, so the live position continues after earlier ones.
  const timelineOffsetMs = sessionDurationMs(session)
  const isCapturing = recorder.status === 'recording' || recorder.status === 'paused'

  const handleStart = async () => {
    stopwatch.reset()
    // Only run the clock when audio is really captured, or notes would drift from the audio.
    if (await recorder.start(session.id)) stopwatch.start()
  }
  const handlePause = () => {
    recorder.pause()
    stopwatch.pause()
  }
  const handleResume = () => {
    recorder.resume()
    stopwatch.start()
  }
  const handleStop = async () => {
    stopwatch.pause()
    await recorder.stop()
    stopwatch.reset()
  }
  const handleNote = (kind: NoteKind, text: string) => {
    const atMs = timelineOffsetMs + (isCapturing ? stopwatch.now() : 0)
    const note = { id: crypto.randomUUID(), atMs, kind, text }
    void mutate((current) => addNote(current, note, new Date().toISOString()))
  }

  return (
    <>
      <header className="session-header">
        <h1>{session.title}</h1>
        <RecordingControls
          status={recorder.status}
          timelineMs={timelineOffsetMs + stopwatch.elapsedMs}
          onStart={() => void handleStart()}
          onPause={handlePause}
          onResume={handleResume}
          onStop={() => void handleStop()}
        />
      </header>
      {recorder.error && <Banner tone="error">{recorder.error}</Banner>}
      <NoteComposer onSubmit={handleNote} />
      <NoteList notes={session.notes} />
      <RecordingList recordings={session.recordings} />
    </>
  )
}

export const App = () => {
  const store = useSessionStore()
  const recovery = store.recovery && recoveryMessage(store.recovery)

  return (
    <main className="app">
      {!services.audioIsPersistent && (
        <Banner tone="error">
          This browser cannot store audio on disk; recordings will be lost when you close the tab.
        </Banner>
      )}
      {recovery && (
        <Banner tone="info" onDismiss={store.dismissRecovery}>
          {recovery}
        </Banner>
      )}
      {store.saveError && <Banner tone="error">Could not save: {store.saveError}</Banner>}
      {store.state.status === 'loading' && <p role="status">Loading your notes…</p>}
      {store.state.status === 'error' && (
        <Banner tone="error">Could not open local storage: {store.state.message}</Banner>
      )}
      {store.state.status === 'ready' && (
        <SessionView
          session={store.state.session}
          mutate={store.mutate}
          runAndReload={store.runAndReload}
        />
      )}
    </main>
  )
}
