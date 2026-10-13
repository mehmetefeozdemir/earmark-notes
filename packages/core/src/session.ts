import { NoteSchema, SCHEMA_VERSION, type Note, type Session } from './schemas'

const UNTITLED_SESSION = 'Untitled session'

const normaliseTitle = (title: string): string => title.trim() || UNTITLED_SESSION

const byTime = (a: Note, b: Note): number => a.atMs - b.atMs

const touch = (session: Session, now: string, changes: Partial<Session>): Session => ({
  ...session,
  ...changes,
  updatedAt: now,
})

const assertNoteExists = (session: Session, noteId: string): void => {
  if (!session.notes.some((note) => note.id === noteId)) {
    throw new Error(`Note "${noteId}" not found in session "${session.id}"`)
  }
}

export interface CreateSessionInput {
  readonly id: string
  readonly title: string
  readonly now: string
}

export const createSession = ({ id, title, now }: CreateSessionInput): Session => ({
  schemaVersion: SCHEMA_VERSION,
  id,
  title: normaliseTitle(title),
  createdAt: now,
  updatedAt: now,
  recordings: [],
  notes: [],
})

export const renameSession = (session: Session, title: string, now: string): Session =>
  touch(session, now, { title: normaliseTitle(title) })

/** Adds a validated note, keeping notes ordered by timeline position. */
export const addNote = (session: Session, note: Note, now: string): Session => {
  const validNote = NoteSchema.parse(note)
  if (session.notes.some((existing) => existing.id === validNote.id)) {
    throw new Error(`Note "${validNote.id}" already exists in session "${session.id}"`)
  }
  return touch(session, now, { notes: [...session.notes, validNote].sort(byTime) })
}

export const updateNoteText = (
  session: Session,
  noteId: string,
  text: string,
  now: string,
): Session => {
  assertNoteExists(session, noteId)
  return touch(session, now, {
    notes: session.notes.map((note) => (note.id === noteId ? { ...note, text } : note)),
  })
}

export const removeNote = (session: Session, noteId: string, now: string): Session => {
  assertNoteExists(session, noteId)
  return touch(session, now, { notes: session.notes.filter((note) => note.id !== noteId) })
}
