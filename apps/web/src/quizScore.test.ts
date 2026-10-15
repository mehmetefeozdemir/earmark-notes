import type { QuizQuestion } from '@earmark/core'
import { describe, expect, test } from 'vitest'
import { scoreQuiz } from './quizScore'

const question = (id: string, correctIndex: number): QuizQuestion => ({
  id,
  question: `Question ${id}?`,
  choices: ['A', 'B', 'C', 'D'],
  correctIndex,
  explanation: '',
  sourceSegmentIndex: 0,
})

const questions = [question('q1', 0), question('q2', 1), question('q3', 2)]

describe('scoreQuiz', () => {
  test('is zero before anything is answered', () => {
    expect(scoreQuiz(questions, {})).toEqual({ answered: 0, correct: 0, total: 3 })
  })

  test('counts answered and correct questions', () => {
    expect(scoreQuiz(questions, { q1: 0, q2: 3 })).toEqual({ answered: 2, correct: 1, total: 3 })
  })

  test('ignores answers to questions that are not in this quiz', () => {
    expect(scoreQuiz(questions, { q9: 0 })).toEqual({ answered: 0, correct: 0, total: 3 })
  })
})
