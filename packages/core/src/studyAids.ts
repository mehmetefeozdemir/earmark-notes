import {
  OutlineSchema,
  QuizSchema,
  type Outline,
  type OutlineSection,
  type Quiz,
  type QuizQuestion,
  type Session,
} from './schemas'

export type { Outline, OutlineSection, Quiz, QuizQuestion } from './schemas'

/** A quiz question as produced by a model, before grounding checks and id assignment. */
export type RawQuizQuestion = Omit<QuizQuestion, 'id'>

const isSegmentIndex = (index: number, segmentCount: number): boolean =>
  Number.isInteger(index) && index >= 0 && index < segmentCount

/**
 * Keeps only sections that start at a real transcript segment, in timeline order, one per
 * start position. Model output is untrusted: anything unverifiable is dropped.
 */
export const sanitizeOutline = (
  sections: readonly OutlineSection[],
  segmentCount: number,
): OutlineSection[] => {
  const seenStarts = new Set<number>()
  const kept = sections
    .filter((section) => section.title.trim().length > 0)
    .filter((section) => isSegmentIndex(section.startSegmentIndex, segmentCount))
    .filter((section) => {
      if (seenStarts.has(section.startSegmentIndex)) return false
      seenStarts.add(section.startSegmentIndex)
      return true
    })
    .sort((a, b) => a.startSegmentIndex - b.startSegmentIndex)
  if (kept.length === 0) throw new Error('The model returned no usable outline sections')
  return kept
}

const normalise = (choice: string): string => choice.trim().toLowerCase()

const MIN_CHOICES = 2
const MAX_CHOICES = 6

const isUsableQuestion = (question: RawQuizQuestion, segmentCount: number): boolean => {
  const { choices } = question
  const hasDistinctChoices = new Set(choices.map(normalise)).size === choices.length
  return (
    question.question.trim().length > 0 &&
    choices.length >= MIN_CHOICES &&
    choices.length <= MAX_CHOICES &&
    choices.every((choice) => choice.trim().length > 0) &&
    hasDistinctChoices &&
    Number.isInteger(question.correctIndex) &&
    question.correctIndex >= 0 &&
    question.correctIndex < choices.length &&
    isSegmentIndex(question.sourceSegmentIndex, segmentCount)
  )
}

export interface SanitizedQuiz {
  readonly questions: QuizQuestion[]
  readonly droppedCount: number
}

/**
 * Drops questions that are not grounded in the transcript or are malformed (bad answer
 * index, duplicate choices). Grounding is checked in code, not trusted from the model.
 */
export const sanitizeQuiz = (
  questions: readonly RawQuizQuestion[],
  segmentCount: number,
): SanitizedQuiz => {
  const usable = questions.filter((question) => isUsableQuestion(question, segmentCount))
  if (usable.length === 0) throw new Error('The model returned no usable quiz questions')
  return {
    questions: usable.map((question, position) => ({ ...question, id: `q${position + 1}` })),
    droppedCount: questions.length - usable.length,
  }
}

export interface StudyAids {
  readonly outline?: Outline
  readonly quiz?: Quiz
}

/** Stores an outline and/or quiz on one recording, replacing earlier ones of the same kind. */
export const attachStudyAids = (
  session: Session,
  recordingId: string,
  aids: StudyAids,
  now: string,
): Session => {
  if (!session.recordings.some((recording) => recording.id === recordingId)) {
    throw new Error(`Recording "${recordingId}" not found in session "${session.id}"`)
  }
  const validated = {
    ...(aids.outline ? { outline: OutlineSchema.parse(aids.outline) } : {}),
    ...(aids.quiz ? { quiz: QuizSchema.parse(aids.quiz) } : {}),
  }
  return {
    ...session,
    recordings: session.recordings.map((recording) =>
      recording.id === recordingId ? { ...recording, ...validated } : recording,
    ),
    updatedAt: now,
  }
}
