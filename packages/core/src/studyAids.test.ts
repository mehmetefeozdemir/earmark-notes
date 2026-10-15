import { describe, expect, test } from 'vitest'
import { appendChunk, attachRecording, finalizeDraft, startRecordingDraft } from './recording'
import { createSession } from './session'
import {
  attachStudyAids,
  sanitizeOutline,
  sanitizeQuiz,
  type Outline,
  type Quiz,
  type RawQuizQuestion,
} from './studyAids'

const T0 = '2026-10-15T09:00:00.000Z'
const T1 = '2026-10-15T10:00:00.000Z'
const SEGMENT_COUNT = 10

describe('sanitizeOutline', () => {
  test('keeps sections that point at real segments, ordered by position', () => {
    const sections = sanitizeOutline(
      [
        { title: 'Later', summary: 'b', startSegmentIndex: 6 },
        { title: 'Intro', summary: 'a', startSegmentIndex: 0 },
      ],
      SEGMENT_COUNT,
    )

    expect(sections.map((section) => section.title)).toEqual(['Intro', 'Later'])
  })

  test('drops sections outside the transcript and duplicates of the same start', () => {
    const sections = sanitizeOutline(
      [
        { title: 'Intro', summary: 'a', startSegmentIndex: 0 },
        { title: 'Ghost', summary: 'x', startSegmentIndex: 42 },
        { title: 'Intro again', summary: 'y', startSegmentIndex: 0 },
      ],
      SEGMENT_COUNT,
    )

    expect(sections.map((section) => section.title)).toEqual(['Intro'])
  })

  test('throws when nothing usable remains', () => {
    expect(() =>
      sanitizeOutline([{ title: 'Ghost', summary: 'x', startSegmentIndex: 99 }], SEGMENT_COUNT),
    ).toThrow(/no usable/i)
  })
})

describe('sanitizeQuiz', () => {
  const valid: RawQuizQuestion = {
    question: 'What is the powerhouse of the cell?',
    choices: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi'],
    correctIndex: 1,
    explanation: 'Mitochondria produce ATP.',
    sourceSegmentIndex: 3,
  }

  test('keeps grounded questions and assigns stable ids', () => {
    const { questions, droppedCount } = sanitizeQuiz([valid], SEGMENT_COUNT)

    expect(droppedCount).toBe(0)
    expect(questions).toEqual([{ ...valid, id: 'q1' }])
  })

  test.each([
    ['a source outside the transcript', { ...valid, sourceSegmentIndex: 10 }],
    ['an answer index that is not a choice', { ...valid, correctIndex: 4 }],
    ['duplicate choices', { ...valid, choices: ['Nucleus', ' nucleus', 'Ribosome', 'Golgi'] }],
    ['too few choices', { ...valid, choices: ['Only one'], correctIndex: 0 }],
    ['an empty question', { ...valid, question: '  ' }],
  ])('drops a question with %s', (_reason, bad) => {
    const { questions, droppedCount } = sanitizeQuiz([valid, bad], SEGMENT_COUNT)

    expect(questions).toHaveLength(1)
    expect(droppedCount).toBe(1)
  })

  test('throws when no question survives', () => {
    expect(() => sanitizeQuiz([{ ...valid, sourceSegmentIndex: -1 }], SEGMENT_COUNT)).toThrow(
      /no usable/i,
    )
  })
})

describe('attachStudyAids', () => {
  const session = () => {
    const draft = appendChunk(
      startRecordingDraft({
        recordingId: 'rec-1',
        sessionId: 's1',
        startedAt: T0,
        mimeType: 'audio/webm',
        source: 'mic',
      }),
      { index: 0, durationMs: 1_000, bytes: 1 },
    )
    return attachRecording(
      createSession({ id: 's1', title: 'Bio', now: T0 }),
      finalizeDraft(draft),
      T0,
    )
  }
  const outline: Outline = {
    model: 'gpt-test',
    createdAt: T1,
    sections: [{ title: 'Intro', summary: 'a', startSegmentIndex: 0 }],
  }
  const quiz: Quiz = {
    model: 'gpt-test',
    createdAt: T1,
    questions: [
      {
        id: 'q1',
        question: 'Q?',
        choices: ['A', 'B'],
        correctIndex: 0,
        explanation: 'Because.',
        sourceSegmentIndex: 0,
      },
    ],
  }

  test('adds an outline, then a quiz, keeping both and not mutating the input', () => {
    const original = session()

    const withOutline = attachStudyAids(original, 'rec-1', { outline }, T1)
    const withBoth = attachStudyAids(withOutline, 'rec-1', { quiz }, T1)

    expect(withBoth.recordings[0]?.outline).toEqual(outline)
    expect(withBoth.recordings[0]?.quiz).toEqual(quiz)
    expect(original.recordings[0]?.outline).toBeUndefined()
    expect(withBoth.updatedAt).toBe(T1)
  })

  test('throws for an unknown recording', () => {
    expect(() => attachStudyAids(session(), 'missing', { outline }, T1)).toThrow(/not found/)
  })
})
