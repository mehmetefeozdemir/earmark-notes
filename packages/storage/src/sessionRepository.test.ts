import 'fake-indexeddb/auto'
import { addNote, createSession, type Session } from '@earmark/core'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { EarmarkDb } from './db'
import { DexieSessionRepository, SessionCorruptedError } from './sessionRepository'

const T0 = '2026-10-13T09:00:00.000Z'
const T1 = '2026-10-13T10:00:00.000Z'
const T2 = '2026-10-13T11:00:00.000Z'

let db: EarmarkDb
let repository: DexieSessionRepository

beforeEach(() => {
  db = new EarmarkDb(`test-${crypto.randomUUID()}`)
  repository = new DexieSessionRepository(db)
})

afterEach(async () => {
  await db.delete()
})

const session = (id: string, title: string, now: string): Session =>
  createSession({ id, title, now })

describe('DexieSessionRepository', () => {
  test('returns undefined for an unknown session', async () => {
    expect(await repository.get('missing')).toBeUndefined()
  })

  test('saves and reads back a session with notes', async () => {
    const original = addNote(
      session('s1', 'Biology', T0),
      { id: 'n1', atMs: 1_500, kind: 'important', text: 'Mitochondria' },
      T1,
    )

    await repository.save(original)

    expect(await repository.get('s1')).toEqual(original)
  })

  test('overwrites an existing session on save', async () => {
    await repository.save(session('s1', 'Draft', T0))

    await repository.save(session('s1', 'Final', T1))

    expect((await repository.get('s1'))?.title).toBe('Final')
  })

  test('lists summaries, most recently updated first', async () => {
    await repository.save(session('old', 'Old', T0))
    await repository.save(session('new', 'New', T2))
    await repository.save(session('mid', 'Mid', T1))

    const { sessions, corruptIds } = await repository.list()

    expect(sessions.map((summary) => summary.id)).toEqual(['new', 'mid', 'old'])
    expect(sessions[0]).toEqual({ id: 'new', title: 'New', updatedAt: T2, noteCount: 0 })
    expect(corruptIds).toEqual([])
  })

  test('deletes a session', async () => {
    await repository.save(session('s1', 'Gone', T0))

    await repository.delete('s1')

    expect(await repository.get('s1')).toBeUndefined()
  })

  test('refuses to save data that does not match the schema', async () => {
    const invalid = { ...session('s1', 'Bad', T0), notes: [{ id: '', atMs: -1 }] }

    await expect(repository.save(invalid as unknown as Session)).rejects.toThrow()
    expect(await db.sessions.count()).toBe(0)
  })

  test('throws SessionCorruptedError when a stored session is invalid', async () => {
    await db.sessions.put({ id: 'broken', title: 42 } as unknown as Session)

    await expect(repository.get('broken')).rejects.toBeInstanceOf(SessionCorruptedError)
  })

  test('reports corrupt rows in list() instead of hiding them or failing everything', async () => {
    await repository.save(session('ok', 'Fine', T0))
    await db.sessions.put({ id: 'broken', title: 42 } as unknown as Session)

    const { sessions, corruptIds } = await repository.list()

    expect(sessions.map((summary) => summary.id)).toEqual(['ok'])
    expect(corruptIds).toEqual(['broken'])
  })
})
