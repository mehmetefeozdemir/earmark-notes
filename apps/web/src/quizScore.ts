import type { QuizQuestion } from '@earmark/core'

/** Chosen choice index per question id. */
export type QuizAnswers = Readonly<Record<string, number>>

export interface QuizScore {
  readonly answered: number
  readonly correct: number
  readonly total: number
}

export const scoreQuiz = (questions: readonly QuizQuestion[], answers: QuizAnswers): QuizScore => {
  const answeredQuestions = questions.filter((question) => answers[question.id] !== undefined)
  return {
    answered: answeredQuestions.length,
    correct: answeredQuestions.filter((question) => answers[question.id] === question.correctIndex)
      .length,
    total: questions.length,
  }
}
