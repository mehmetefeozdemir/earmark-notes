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

/** A slice of recorded audio persisted separately (e.g. in OPFS), keyed by its index. */
export const AudioChunkSchema = z.object({
  index: z.number().int().nonnegative(),
  offsetMs: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
})
export type AudioChunk = z.infer<typeof AudioChunkSchema>

export const RecordingSourceSchema = z.enum(['mic', 'tab', 'tab+mic', 'import'])
export type RecordingSource = z.infer<typeof RecordingSourceSchema>

/** A chapter of a recording; `startSegmentIndex` points into its transcript segments. */
export const OutlineSectionSchema = z.object({
  title: z.string().trim().min(1),
  summary: z.string(),
  startSegmentIndex: z.number().int().nonnegative(),
})
export type OutlineSection = z.infer<typeof OutlineSectionSchema>

export const OutlineSchema = z.object({
  model: z.string().min(1),
  createdAt: z.iso.datetime(),
  sections: z.array(OutlineSectionSchema).min(1),
})
export type Outline = z.infer<typeof OutlineSchema>

/** A multiple-choice question grounded in one transcript segment. */
export const QuizQuestionSchema = z.object({
  id: z.string().min(1),
  question: z.string().trim().min(1),
  choices: z.array(z.string().trim().min(1)).min(2).max(6),
  correctIndex: z.number().int().nonnegative(),
  explanation: z.string(),
  sourceSegmentIndex: z.number().int().nonnegative(),
})
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>

export const QuizSchema = z.object({
  model: z.string().min(1),
  createdAt: z.iso.datetime(),
  questions: z.array(QuizQuestionSchema).min(1),
})
export type Quiz = z.infer<typeof QuizSchema>

export const RecordingSchema = z.object({
  id: z.string().min(1),
  startedAt: z.iso.datetime(),
  durationMs: z.number().int().nonnegative(),
  source: RecordingSourceSchema,
  mimeType: z.string().min(1),
  chunks: z.array(AudioChunkSchema),
  transcript: TranscriptSchema.optional(),
  outline: OutlineSchema.optional(),
  quiz: QuizSchema.optional(),
})
export type Recording = z.infer<typeof RecordingSchema>

/**
 * A recording in progress. Persisted after every chunk so an interrupted recording can be
 * recovered into its session on the next launch.
 */
export const RecordingDraftSchema = z.object({
  recordingId: z.string().min(1),
  sessionId: z.string().min(1),
  startedAt: z.iso.datetime(),
  mimeType: z.string().min(1),
  source: RecordingSourceSchema,
  chunks: z.array(AudioChunkSchema),
})
export type RecordingDraft = z.infer<typeof RecordingDraftSchema>

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
