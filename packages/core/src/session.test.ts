import { describe, expect, test } from 'vitest'
import { addNote, createSession, removeNote, renameSession, updateNoteText } from './session'
import { SessionSchema } from './schemas'

const CREATED_AT = '2026-10-13T09:00:00.000Z'
const LATER = '2026-10-13T09:05:00.000Z'

const baseSession = () => createSession({ id: 's1', title: 'Lecture 1', now: CREATED_AT })

describe('createSession', () => {
  test('creates an empty session that satisfies the schema', () => {
    const session = baseSession()

    expect(SessionSchema.parse(session)).toEqual(session)
    expect(session.notes).toEqual([])
    expect(session.recordings).toEqual([])
    expect(session.createdAt).toBe(CREATED_AT)
    expect(session.updatedAt).toBe(CREATED_AT)
  })

  test('trims the title and falls back to "Untitled session" when blank', () => {
    expect(createSession({ id: 'a', title: '  Physics  ', now: CREATED_AT }).title).toBe('Physics')
    expect(createSession({ id: 'b', title: '   ', now: CREATED_AT }).title).toBe('Untitled session')
  })
})

describe('addNote', () => {
  test('returns a new session with the note and does not mutate the original', () => {
    const original = baseSession()

    const updated = addNote(original, { id: 'n1', atMs: 5_000, kind: 'text', text: 'Hello' }, LATER)

    expect(updated).not.toBe(original)
    expect(original.notes).toHaveLength(0)
    expect(updated.notes).toEqual([{ id: 'n1', atMs: 5_000, kind: 'text', text: 'Hello' }])
    expect(updated.updatedAt).toBe(LATER)
  })

  test('keeps notes ordered by time even when added out of order', () => {
    let session = baseSession()
    session = addNote(session, { id: 'late', atMs: 9_000, kind: 'text', text: 'b' }, LATER)
    session = addNote(session, { id: 'early', atMs: 1_000, kind: 'important', text: 'a' }, LATER)

    expect(session.notes.map((note) => note.id)).toEqual(['early', 'late'])
  })

  test('rejects a negative timestamp', () => {
    expect(() =>
      addNote(baseSession(), { id: 'n', atMs: -1, kind: 'text', text: 'x' }, LATER),
    ).toThrow()
  })

  test('rejects a duplicate note id', () => {
    const session = addNote(baseSession(), { id: 'n', atMs: 0, kind: 'text', text: 'x' }, LATER)

    expect(() => addNote(session, { id: 'n', atMs: 10, kind: 'text', text: 'y' }, LATER)).toThrow(
      /already exists/,
    )
  })
})

describe('updateNoteText', () => {
  test('changes only the targeted note', () => {
    let session = baseSession()
    session = addNote(session, { id: 'a', atMs: 0, kind: 'text', text: 'one' }, LATER)
    session = addNote(session, { id: 'b', atMs: 1, kind: 'text', text: 'two' }, LATER)

    const updated = updateNoteText(session, 'b', 'TWO', '2026-10-13T10:00:00.000Z')

    expect(updated.notes.map((note) => note.text)).toEqual(['one', 'TWO'])
    expect(session.notes[1]?.text).toBe('two')
    expect(updated.updatedAt).toBe('2026-10-13T10:00:00.000Z')
  })

  test('throws when the note does not exist', () => {
    expect(() => updateNoteText(baseSession(), 'missing', 'x', LATER)).toThrow(/not found/)
  })
})

describe('removeNote', () => {
  test('removes the note without mutating the original', () => {
    const session = addNote(baseSession(), { id: 'a', atMs: 0, kind: 'task', text: 'do' }, LATER)

    const updated = removeNote(session, 'a', LATER)

    expect(updated.notes).toEqual([])
    expect(session.notes).toHaveLength(1)
  })

  test('throws when the note does not exist', () => {
    expect(() => removeNote(baseSession(), 'missing', LATER)).toThrow(/not found/)
  })
})

describe('renameSession', () => {
  test('renames and bumps updatedAt', () => {
    const renamed = renameSession(baseSession(), ' Chemistry ', LATER)

    expect(renamed.title).toBe('Chemistry')
    expect(renamed.updatedAt).toBe(LATER)
  })
})
