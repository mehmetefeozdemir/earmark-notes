import { describe, expect, test } from 'vitest'
import { appendChunk, attachRecording, finalizeDraft, startRecordingDraft } from './recording'
import type { RecordingDraft } from './schemas'
import { createSession } from './session'

const STARTED_AT = '2026-10-13T09:00:00.000Z'
const NOW = '2026-10-13T10:00:00.000Z'

const newDraft = (): RecordingDraft =>
  startRecordingDraft({
    recordingId: 'rec-1',
    sessionId: 's1',
    startedAt: STARTED_AT,
    mimeType: 'audio/webm;codecs=opus',
    source: 'mic',
  })

describe('startRecordingDraft', () => {
  test('starts with no chunks', () => {
    expect(newDraft()).toEqual({
      recordingId: 'rec-1',
      sessionId: 's1',
      startedAt: STARTED_AT,
      mimeType: 'audio/webm;codecs=opus',
      source: 'mic',
      chunks: [],
    })
  })
})

describe('appendChunk', () => {
  test('computes each chunk offset from the previous durations, immutably', () => {
    const empty = newDraft()

    const one = appendChunk(empty, { index: 0, durationMs: 5_000, bytes: 30_000 })
    const two = appendChunk(one, { index: 1, durationMs: 4_200, bytes: 25_000 })

    expect(empty.chunks).toEqual([])
    expect(two.chunks).toEqual([
      { index: 0, offsetMs: 0, durationMs: 5_000, bytes: 30_000 },
      { index: 1, offsetMs: 5_000, durationMs: 4_200, bytes: 25_000 },
    ])
  })

  test('rejects a gap or repeat in chunk indices', () => {
    const one = appendChunk(newDraft(), { index: 0, durationMs: 1, bytes: 1 })

    expect(() => appendChunk(one, { index: 2, durationMs: 1, bytes: 1 })).toThrow(/expected 1/)
    expect(() => appendChunk(one, { index: 0, durationMs: 1, bytes: 1 })).toThrow(/expected 1/)
  })

  test('rejects negative duration or size', () => {
    expect(() => appendChunk(newDraft(), { index: 0, durationMs: -1, bytes: 1 })).toThrow()
    expect(() => appendChunk(newDraft(), { index: 0, durationMs: 1, bytes: -1 })).toThrow()
  })
})

describe('finalizeDraft', () => {
  test('turns a draft into a recording whose duration is the sum of its chunks', () => {
    const draft = appendChunk(appendChunk(newDraft(), { index: 0, durationMs: 5_000, bytes: 10 }), {
      index: 1,
      durationMs: 2_500,
      bytes: 5,
    })

    const recording = finalizeDraft(draft)

    expect(recording).toEqual({
      id: 'rec-1',
      startedAt: STARTED_AT,
      durationMs: 7_500,
      source: 'mic',
      mimeType: 'audio/webm;codecs=opus',
      chunks: draft.chunks,
    })
  })

  test('refuses to finalize a draft without audio', () => {
    expect(() => finalizeDraft(newDraft())).toThrow(/no audio/)
  })
})

describe('attachRecording', () => {
  const recording = finalizeDraft(
    appendChunk(newDraft(), { index: 0, durationMs: 1_000, bytes: 10 }),
  )

  test('adds the recording to the session without mutating it', () => {
    const session = createSession({ id: 's1', title: 'Physics', now: STARTED_AT })

    const updated = attachRecording(session, recording, NOW)

    expect(updated.recordings).toEqual([recording])
    expect(updated.updatedAt).toBe(NOW)
    expect(session.recordings).toEqual([])
  })

  test('throws when the same recording is attached twice', () => {
    const session = attachRecording(
      createSession({ id: 's1', title: 'Physics', now: STARTED_AT }),
      recording,
      NOW,
    )

    expect(() => attachRecording(session, recording, NOW)).toThrow(/already/)
  })
})
