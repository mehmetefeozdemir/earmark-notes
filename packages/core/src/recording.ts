import { z } from 'zod'
import {
  RecordingDraftSchema,
  TranscriptSchema,
  type Transcript,
  type Recording,
  type RecordingDraft,
  type RecordingSource,
  type Session,
} from './schemas'

export interface StartRecordingDraftInput {
  readonly recordingId: string
  readonly sessionId: string
  readonly startedAt: string
  readonly mimeType: string
  readonly source: RecordingSource
}

export const startRecordingDraft = (input: StartRecordingDraftInput): RecordingDraft =>
  RecordingDraftSchema.parse({ ...input, chunks: [] })

const NewChunkSchema = z.object({
  index: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
})
export type NewChunk = z.infer<typeof NewChunkSchema>

const totalDuration = (draft: RecordingDraft): number =>
  draft.chunks.reduce((sum, chunk) => sum + chunk.durationMs, 0)

/**
 * Records a chunk that has already been written to the chunk store. Indices must be
 * contiguous so timeline offsets stay correct and gaps are detected, not hidden.
 */
export const appendChunk = (draft: RecordingDraft, chunk: NewChunk): RecordingDraft => {
  const validChunk = NewChunkSchema.parse(chunk)
  const expectedIndex = draft.chunks.length
  if (validChunk.index !== expectedIndex) {
    throw new Error(
      `Chunk index ${validChunk.index} out of order for recording "${draft.recordingId}": expected ${expectedIndex}`,
    )
  }
  return {
    ...draft,
    chunks: [...draft.chunks, { ...validChunk, offsetMs: totalDuration(draft) }],
  }
}

export const finalizeDraft = (draft: RecordingDraft): Recording => {
  if (draft.chunks.length === 0) {
    throw new Error(`Recording "${draft.recordingId}" has no audio to finalize`)
  }
  return {
    id: draft.recordingId,
    startedAt: draft.startedAt,
    durationMs: totalDuration(draft),
    source: draft.source,
    mimeType: draft.mimeType,
    chunks: draft.chunks,
  }
}

export const attachRecording = (session: Session, recording: Recording, now: string): Session => {
  if (session.recordings.some((existing) => existing.id === recording.id)) {
    throw new Error(`Recording "${recording.id}" is already attached to session "${session.id}"`)
  }
  return { ...session, recordings: [...session.recordings, recording], updatedAt: now }
}

/** Stores (or replaces) the transcript of one recording. Segment times are relative to it. */
export const attachTranscript = (
  session: Session,
  recordingId: string,
  transcript: Transcript,
  now: string,
): Session => {
  if (!session.recordings.some((recording) => recording.id === recordingId)) {
    throw new Error(`Recording "${recordingId}" not found in session "${session.id}"`)
  }
  const validTranscript = TranscriptSchema.parse(transcript)
  return {
    ...session,
    recordings: session.recordings.map((recording) =>
      recording.id === recordingId ? { ...recording, transcript: validTranscript } : recording,
    ),
    updatedAt: now,
  }
}
