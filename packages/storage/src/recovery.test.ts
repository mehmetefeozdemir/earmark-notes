import 'fake-indexeddb/auto'
import {
  appendChunk,
  attachRecording,
  createSession,
  finalizeDraft,
  startRecordingDraft,
  type RecordingDraft,
} from '@earmark/core'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { MemoryAudioChunkStore } from './audioChunkStore'
import { EarmarkDb } from './db'
import { DexieRecordingDraftRepository } from './recordingDraftRepository'
import { recoverInterruptedRecordings } from './recovery'
import { DexieSessionRepository } from './sessionRepository'

const STARTED_AT = '2026-10-13T09:00:00.000Z'
const NOW = '2026-10-13T12:00:00.000Z'

let db: EarmarkDb
let sessions: DexieSessionRepository
let drafts: DexieRecordingDraftRepository
let chunks: MemoryAudioChunkStore

beforeEach(() => {
  db = new EarmarkDb(`test-${crypto.randomUUID()}`)
  sessions = new DexieSessionRepository(db)
  drafts = new DexieRecordingDraftRepository(db)
  chunks = new MemoryAudioChunkStore()
})

afterEach(async () => {
  await db.delete()
})

const draftWithChunks = (recordingId: string, sessionId: string, count: number): RecordingDraft => {
  let draft = startRecordingDraft({
    recordingId,
    sessionId,
    startedAt: STARTED_AT,
    mimeType: 'audio/webm',
    source: 'mic',
  })
  for (let index = 0; index < count; index += 1) {
    draft = appendChunk(draft, { index, durationMs: 5_000, bytes: 100 })
  }
  return draft
}

const recover = () => recoverInterruptedRecordings({ sessions, drafts, chunks, now: NOW })

describe('DexieRecordingDraftRepository', () => {
  test('saves, lists and deletes drafts', async () => {
    const draft = draftWithChunks('rec-1', 's1', 1)

    await drafts.save(draft)
    expect((await drafts.list()).drafts).toEqual([draft])

    await drafts.delete('rec-1')
    expect((await drafts.list()).drafts).toEqual([])
  })

  test('refuses to save an invalid draft', async () => {
    await expect(drafts.save({ recordingId: '' } as unknown as RecordingDraft)).rejects.toThrow()
  })
})

describe('recoverInterruptedRecordings', () => {
  test('does nothing when there are no drafts', async () => {
    expect(await recover()).toEqual({ recovered: [], discarded: [], corruptIds: [] })
  })

  test('attaches an interrupted recording to its session and clears the draft', async () => {
    await sessions.save(createSession({ id: 's1', title: 'Physics', now: STARTED_AT }))
    await drafts.save(draftWithChunks('rec-1', 's1', 2))

    const report = await recover()

    expect(report.recovered).toEqual([{ recordingId: 'rec-1', sessionId: 's1' }])
    const session = await sessions.get('s1')
    expect(session?.recordings.map((recording) => recording.durationMs)).toEqual([10_000])
    expect(session?.updatedAt).toBe(NOW)
    expect((await drafts.list()).drafts).toEqual([])
  })

  test('discards a draft that captured no audio, including any stray chunk files', async () => {
    await sessions.save(createSession({ id: 's1', title: 'Physics', now: STARTED_AT }))
    await drafts.save(draftWithChunks('rec-empty', 's1', 0))
    await chunks.write('rec-empty', 0, new Blob(['partial']))

    const report = await recover()

    expect(report.discarded).toEqual(['rec-empty'])
    expect((await sessions.get('s1'))?.recordings).toEqual([])
    expect(await chunks.list('rec-empty')).toEqual([])
    expect((await drafts.list()).drafts).toEqual([])
  })

  test('creates a session for a recording whose session no longer exists', async () => {
    await drafts.save(draftWithChunks('rec-1', 'deleted-session', 1))

    const report = await recover()

    expect(report.recovered).toEqual([{ recordingId: 'rec-1', sessionId: 'deleted-session' }])
    const session = await sessions.get('deleted-session')
    expect(session?.title).toBe('Recovered recording')
    expect(session?.recordings).toHaveLength(1)
  })

  test('is safe to re-run after a crash between saving the session and deleting the draft', async () => {
    const draft = draftWithChunks('rec-1', 's1', 1)
    const alreadyAttached = attachRecording(
      createSession({ id: 's1', title: 'Physics', now: STARTED_AT }),
      finalizeDraft(draft),
      STARTED_AT,
    )
    await sessions.save(alreadyAttached)
    await drafts.save(draft)

    const report = await recover()

    expect(report.recovered).toEqual([{ recordingId: 'rec-1', sessionId: 's1' }])
    expect((await sessions.get('s1'))?.recordings).toHaveLength(1)
    expect((await drafts.list()).drafts).toEqual([])
  })

  test('reports corrupt drafts and leaves them in place for inspection', async () => {
    await db.recordingDrafts.put({
      recordingId: 'broken',
      chunks: 'nope',
    } as unknown as RecordingDraft)

    const report = await recover()

    expect(report.corruptIds).toEqual(['broken'])
    expect(await db.recordingDrafts.count()).toBe(1)
  })
})
