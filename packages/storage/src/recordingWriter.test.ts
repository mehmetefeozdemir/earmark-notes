import 'fake-indexeddb/auto'
import { createSession } from '@lecture-notes/core'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { MemoryAudioChunkStore } from './audioChunkStore'
import { LectureNotesDb } from './db'
import { DexieRecordingDraftRepository } from './recordingDraftRepository'
import { RecordingWriter } from './recordingWriter'
import { DexieSessionRepository } from './sessionRepository'

const STARTED_AT = '2026-10-13T09:00:00.000Z'
const NOW = '2026-10-13T09:30:00.000Z'
const MIME = 'audio/webm;codecs=opus'

let db: LectureNotesDb
let sessions: DexieSessionRepository
let drafts: DexieRecordingDraftRepository
let chunks: MemoryAudioChunkStore

beforeEach(async () => {
  db = new LectureNotesDb(`test-${crypto.randomUUID()}`)
  sessions = new DexieSessionRepository(db)
  drafts = new DexieRecordingDraftRepository(db)
  chunks = new MemoryAudioChunkStore()
  await sessions.save(createSession({ id: 's1', title: 'Physics', now: STARTED_AT }))
})

afterEach(async () => {
  await db.delete()
})

const begin = () =>
  RecordingWriter.begin(
    { recordingId: 'rec-1', sessionId: 's1', startedAt: STARTED_AT, mimeType: MIME, source: 'mic' },
    { sessions, drafts, chunks },
  )

describe('RecordingWriter', () => {
  test('persists a draft as soon as recording begins', async () => {
    await begin()

    expect((await drafts.list()).drafts.map((draft) => draft.recordingId)).toEqual(['rec-1'])
  })

  test('writes each chunk to the chunk store before recording it in the draft', async () => {
    const writer = await begin()

    await writer.writeChunk({ index: 0, blob: new Blob(['abc']), durationMs: 5_000 })

    expect(await chunks.list('rec-1')).toEqual([0])
    const [draft] = (await drafts.list()).drafts
    expect(draft?.chunks).toEqual([{ index: 0, offsetMs: 0, durationMs: 5_000, bytes: 3 }])
  })

  test('leaves the draft unchanged when the chunk cannot be stored', async () => {
    const writer = await begin()
    const failingStore = Object.assign(Object.create(chunks), {
      write: () => Promise.reject(new Error('quota exceeded')),
    })
    const failingWriter = await RecordingWriter.begin(
      {
        recordingId: 'rec-2',
        sessionId: 's1',
        startedAt: STARTED_AT,
        mimeType: MIME,
        source: 'mic',
      },
      { sessions, drafts, chunks: failingStore },
    )

    await expect(
      failingWriter.writeChunk({ index: 0, blob: new Blob(['x']), durationMs: 1 }),
    ).rejects.toThrow('quota exceeded')

    const draft = (await drafts.list()).drafts.find((entry) => entry.recordingId === 'rec-2')
    expect(draft?.chunks).toEqual([])
    expect(writer).toBeDefined()
  })

  test('finish() attaches the recording to the session and clears the draft', async () => {
    const writer = await begin()
    await writer.writeChunk({ index: 0, blob: new Blob(['a']), durationMs: 5_000 })
    await writer.writeChunk({ index: 1, blob: new Blob(['b']), durationMs: 2_000 })

    const recording = await writer.finish(NOW)

    expect(recording?.durationMs).toBe(7_000)
    const session = await sessions.get('s1')
    expect(session?.recordings.map((entry) => entry.id)).toEqual(['rec-1'])
    expect(session?.updatedAt).toBe(NOW)
    expect((await drafts.list()).drafts).toEqual([])
    expect(await (await chunks.read('rec-1', MIME)).text()).toBe('ab')
  })

  test('finish() discards a recording that captured no audio', async () => {
    const writer = await begin()

    const recording = await writer.finish(NOW)

    expect(recording).toBeUndefined()
    expect((await sessions.get('s1'))?.recordings).toEqual([])
    expect((await drafts.list()).drafts).toEqual([])
  })
})
