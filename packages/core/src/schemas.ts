import { z } from 'zod'

export const SCHEMA_VERSION = 1

export const NoteKindSchema = z.enum([
  'text',
  'heading',
  'important',
  'question',
  'confused',
  'task',
])
export type NoteKind = z.infer<typeof NoteKindSchema>

/** A note pinned to a moment of the session timeline. */
export const NoteSchema = z.object({
  id: z.string().min(1),
  atMs: z.number().int().nonnegative(),
  kind: NoteKindSchema,
  text: z.string(),
})
export type Note = z.infer<typeof NoteSchema>

export const TranscriptSegmentSchema = z
  .object({
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().nonnegative(),
    text: z.string(),
    speaker: z.string().optional(),
  })
  .refine((segment) => segment.endMs >= segment.startMs, {
    message: 'endMs must be >= startMs',
  })
export type TranscriptSegment = z.infer<typeof TranscriptSegmentSchema>

export const TranscriptSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  language: z.string().min(2),
  createdAt: z.iso.datetime(),
  segments: z.array(TranscriptSegmentSchema),
})
export type Transcript = z.infer<typeof TranscriptSchema>

/** A slice of recorded audio persisted separately (e.g. in OPFS). */
export const AudioChunkSchema = z.object({
  id: z.string().min(1),
  offsetMs: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
})
export type AudioChunk = z.infer<typeof AudioChunkSchema>

export const RecordingSourceSchema = z.enum(['mic', 'tab', 'tab+mic', 'import'])
export type RecordingSource = z.infer<typeof RecordingSourceSchema>

export const RecordingSchema = z.object({
  id: z.string().min(1),
  startedAt: z.iso.datetime(),
  durationMs: z.number().int().nonnegative(),
  source: RecordingSourceSchema,
  mimeType: z.string().min(1),
  chunks: z.array(AudioChunkSchema),
  transcript: TranscriptSchema.optional(),
})
export type Recording = z.infer<typeof RecordingSchema>

export const SessionSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string().min(1),
  title: z.string().min(1),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  recordings: z.array(RecordingSchema),
  notes: z.array(NoteSchema),
})
export type Session = z.infer<typeof SessionSchema>
