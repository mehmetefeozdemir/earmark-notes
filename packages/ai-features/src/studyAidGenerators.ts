import {
  sanitizeOutline,
  sanitizeQuiz,
  type Outline,
  type OutlineSection,
  type Quiz,
  type RawQuizQuestion,
  type Transcript,
} from '@earmark/core'
import type { ChatMessage, JsonChatClient } from '@earmark/providers'
import { z } from 'zod'
import { GenerationError, generateValidated } from './generateValidated'

/** Roughly 3–4 hours of speech; beyond this we need map-reduce, not one prompt. */
const MAX_TRANSCRIPT_CHARS = 300_000
const DEFAULT_QUESTION_COUNT = 5

const SYSTEM_PROMPT = `You turn lecture transcripts into study material for a student.
The transcript is given as numbered lines: "[index] text".
Rules:
- Respond with a single JSON object and nothing else.
- Use only facts stated in the transcript. Never invent facts.
- When asked for a line index, use the [index] of the line where the content appears.`

const RawOutlineSchema = z.object({
  sections: z
    .array(
      z.object({
        title: z.string(),
        summary: z.string(),
        startSegmentIndex: z.number().int(),
      }),
    )
    .min(1),
})

const RawQuizSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string(),
        choices: z.array(z.string()),
        correctIndex: z.number().int(),
        explanation: z.string(),
        sourceSegmentIndex: z.number().int(),
      }),
    )
    .min(1),
})

export const formatTranscriptForPrompt = (transcript: Transcript): string =>
  transcript.segments.map((segment, index) => `[${index}] ${segment.text}`).join('\n')

const promptFor = (transcript: Transcript, task: string): ChatMessage[] => {
  if (transcript.segments.length === 0) {
    throw new GenerationError('The transcript is empty; transcribe the recording first.')
  }
  const lines = formatTranscriptForPrompt(transcript)
  if (lines.length > MAX_TRANSCRIPT_CHARS) {
    throw new GenerationError('This transcript is too long to process in one request.')
  }
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Transcript (language: ${transcript.language}):\n${lines}\n\n${task}\nWrite all text in ${transcript.language}.`,
    },
  ]
}

interface GeneratorInput {
  readonly client: JsonChatClient
  readonly transcript: Transcript
  readonly now?: () => string
  readonly signal?: AbortSignal
}

const timestamp = (now?: () => string): string => (now ? now() : new Date().toISOString())

export const generateOutline = async ({
  client,
  transcript,
  now,
  signal,
}: GeneratorInput): Promise<Outline> => {
  const messages = promptFor(
    transcript,
    `Split the lecture into 3 to 8 sections in order.
Return {"sections":[{"title":string,"summary":string,"startSegmentIndex":number}]}.
"summary" is one sentence. "startSegmentIndex" is the line index where the section begins.`,
  )
  const segmentCount = transcript.segments.length
  const sections: OutlineSection[] = await generateValidated({
    client,
    messages,
    schema: RawOutlineSchema,
    refine: (raw) => ({ sections: sanitizeOutline(raw.sections, segmentCount) }),
    ...(signal ? { signal } : {}),
  }).then((result) => result.sections)
  return { model: client.model, createdAt: timestamp(now), sections }
}

export interface QuizGeneratorInput extends GeneratorInput {
  readonly questionCount?: number
}

export interface GeneratedQuiz {
  readonly quiz: Quiz
  /** Questions discarded because they were not grounded in the transcript or malformed. */
  readonly droppedCount: number
}

export const generateQuiz = async ({
  client,
  transcript,
  questionCount = DEFAULT_QUESTION_COUNT,
  now,
  signal,
}: QuizGeneratorInput): Promise<GeneratedQuiz> => {
  const messages = promptFor(
    transcript,
    `Write ${questionCount} multiple-choice questions that test understanding of the lecture.
Return {"questions":[{"question":string,"choices":[4 strings],"correctIndex":number,"explanation":string,"sourceSegmentIndex":number}]}.
"correctIndex" is the 0-based index of the right choice. Choices must be distinct.
"sourceSegmentIndex" is the line index that contains the answer.`,
  )
  const segmentCount = transcript.segments.length
  const raw = await generateValidated({
    client,
    messages,
    schema: RawQuizSchema,
    // Throws (and so triggers a repair) only when no question at all is usable.
    refine: (value) => {
      sanitizeQuiz(value.questions as RawQuizQuestion[], segmentCount)
      return value
    },
    ...(signal ? { signal } : {}),
  })
  const { questions, droppedCount } = sanitizeQuiz(raw.questions, segmentCount)
  return { quiz: { model: client.model, createdAt: timestamp(now), questions }, droppedCount }
}
