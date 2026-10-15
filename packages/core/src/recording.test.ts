import { describe, expect, test } from 'vitest'
import {
  appendChunk,
  attachRecording,
  attachTranscript,
  finalizeDraft,
  startRecordingDraft,
} from './recording'
import type { RecordingDraft, Transcript } from './schemas'
import { createSession } from './session'

describe('attachTranscript', () => {
  const T0 = '2026-10-15T09:00:00.000Z'
  const T1 = '2026-10-15T09:10:00.000Z'
  const transcript: Transcript = {
    provider: 'openai',
    model: 'whisper-1',
    language: 'english',
    createdAt: T1,
    segments: [{ startMs: 0, endMs: 1_000, text: 'Hello' }],
  }
  const sessionWithRecording = () => {
    const draft = appendChunk(
      startRecordingDraft({
        recordingId: 'rec-1',
        sessionId: 's1',
        startedAt: T0,
        mimeType: 'audio/webm',
        source: 'mic',
      }),
      { index: 0, durationMs: 1_000, bytes: 10 },
    )
    return attachRecording(
      createSession({ id: 's1', title: 'Bio', now: T0 }),
      finalizeDraft(draft),
      T0,
    )
  }

  test('stores the transcript on the recording without mutating the session', () => {
    const session = sessionWithRecording()

    const updated = attachTranscript(session, 'rec-1', transcript, T1)

    expect(updated.recordings[0]?.transcript).toEqual(transcript)
    expect(updated.updatedAt).toBe(T1)
    expect(session.recordings[0]?.transcript).toBeUndefined()
  })

  test('replaces an earlier transcript (e.g. re-transcribed with another provider)', () => {
    const once = attachTranscript(sessionWithRecording(), 'rec-1', transcript, T1)
    const replacement = { ...transcript, provider: 'groq', model: 'whisper-large-v3' }

    const twice = attachTranscript(once, 'rec-1', replacement, T1)

    expect(twice.recordings[0]?.transcript?.provider).toBe('groq')
  })

  test('throws for an unknown recording', () => {
    expect(() => attachTranscript(sessionWithRecording(), 'missing', transcript, T1)).toThrow(
      /not found/,
    )
  })

  test('rejects an invalid transcript', () => {
    const invalid = { ...transcript, segments: [{ startMs: 5, endMs: 1, text: 'x' }] }

    expect(() => attachTranscript(sessionWithRecording(), 'rec-1', invalid, T1)).toThrow()
  })
})

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
