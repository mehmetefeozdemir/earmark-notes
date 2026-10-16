import {
  addNote,
  renameSession,
  sessionDurationMs,
  type NoteKind,
  type Session,
} from '@earmark/core'
import type { RecoveryReport, SessionSummary } from '@earmark/storage'
import { Banner } from './components/Banner'
import { NoteComposer } from './components/NoteComposer'
import { NoteList } from './components/NoteList'
import { RecordingControls } from './components/RecordingControls'
import { RecordingList } from './components/RecordingList'
import { SessionPicker } from './components/SessionPicker'
import { SessionTitle } from './components/SessionTitle'
import { SettingsPanel } from './components/SettingsPanel'
import { useStudyAids } from './useStudyAids'
import { useTranscription } from './useTranscription'
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
  readonly summaries: readonly SessionSummary[]
  readonly onOpenSession: (id: string) => void
  readonly onNewSession: () => void
}

const SessionView = ({
  session,
  mutate,
  runAndReload,
  summaries,
  onOpenSession,
  onNewSession,
}: SessionViewProps) => {
  const recorder = useRecorder({ runAndReload })
  const transcription = useTranscription({ mutate })
  const studyAids = useStudyAids({ mutate })
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

  const isBusy = isCapturing || recorder.status === 'starting' || recorder.status === 'stopping'

  return (
    <>
      <SessionPicker
        currentId={session.id}
        summaries={summaries}
        isLocked={isBusy}
        onOpen={onOpenSession}
        onNew={onNewSession}
      />
      <header className="session-header">
        <SessionTitle
          title={session.title}
          onRename={(title) =>
            void mutate((current) => renameSession(current, title, new Date().toISOString()))
          }
        />
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
      <RecordingList
        recordings={session.recordings}
        statuses={transcription.statuses}
        onTranscribe={(recording) => void transcription.transcribe(recording)}
        studyAids={{
          generate: (recording, kind) => void studyAids.generate(recording, kind),
          statusFor: studyAids.statusFor,
        }}
      />
    </>
  )
}

export const App = () => {
  const store = useSessionStore()
  const recovery = store.recovery && recoveryMessage(store.recovery)

  return (
    <main className="app">
      <SettingsPanel />
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
          // A new key per lecture resets recorder, clock and per-recording UI state.
          key={store.state.session.id}
          session={store.state.session}
          mutate={store.mutate}
          runAndReload={store.runAndReload}
          summaries={store.summaries}
          onOpenSession={(id) => void store.openSession(id)}
          onNewSession={() => void store.startNewSession()}
        />
      )}
    </main>
  )
}
