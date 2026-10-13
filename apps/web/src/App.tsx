import { addNote, createSession, type NoteKind, type Session } from '@lecture-notes/core'
import { useState, type FormEvent } from 'react'
import { formatTimestamp } from './formatTimestamp'
import { useStopwatch } from './useStopwatch'

const NOTE_KINDS: readonly NoteKind[] = ['text', 'heading', 'important', 'question', 'confused']

const nowIso = () => new Date().toISOString()

export const App = () => {
  const [session, setSession] = useState<Session>(() =>
    createSession({ id: crypto.randomUUID(), title: 'My first lecture', now: nowIso() }),
  )
  const [draft, setDraft] = useState('')
  const [kind, setKind] = useState<NoteKind>('text')
  const stopwatch = useStopwatch()

  const submitNote = (event: FormEvent) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    const note = { id: crypto.randomUUID(), atMs: stopwatch.now(), kind, text }
    setSession((current) => addNote(current, note, nowIso()))
    setDraft('')
  }

  return (
    <main className="app">
      <header className="app__header">
        <h1>{session.title}</h1>
        <div className="app__clock" aria-live="off">
          {formatTimestamp(stopwatch.elapsedMs)}
        </div>
        <button type="button" onClick={stopwatch.isRunning ? stopwatch.pause : stopwatch.start}>
          {stopwatch.isRunning ? 'Pause' : 'Start'}
        </button>
      </header>

      <form className="app__composer" onSubmit={submitNote}>
        <select
          aria-label="Note type"
          value={kind}
          onChange={(event) => setKind(event.target.value as NoteKind)}
        >
          {NOTE_KINDS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <input
          aria-label="Note text"
          placeholder="Type a note and press Enter"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </form>

      <ol className="app__notes">
        {session.notes.map((note) => (
          <li key={note.id} className={`note note--${note.kind}`}>
            <time>{formatTimestamp(note.atMs)}</time>
            <span>{note.text}</span>
          </li>
        ))}
      </ol>
    </main>
  )
}
