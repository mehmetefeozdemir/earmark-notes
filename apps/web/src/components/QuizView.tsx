import type { Quiz, QuizQuestion, Transcript } from '@earmark/core'
import { useState } from 'react'
import { scoreQuiz, type QuizAnswers } from '../quizScore'

interface QuestionCardProps {
  readonly question: QuizQuestion
  readonly position: number
  readonly chosen: number | undefined
  readonly onChoose: (choiceIndex: number) => void
  readonly onHearSource: () => void
}

const QuestionCard = ({
  question,
  position,
  chosen,
  onChoose,
  onHearSource,
}: QuestionCardProps) => {
  const isAnswered = chosen !== undefined
  const isCorrect = chosen === question.correctIndex
  return (
    <li className="quiz__question">
      <p>
        {position + 1}. {question.question}
      </p>
      <div
        className="quiz__choices"
        role="group"
        aria-label={`Choices for question ${position + 1}`}
      >
        {question.choices.map((choice, index) => {
          const state = !isAnswered
            ? ''
            : index === question.correctIndex
              ? 'quiz__choice--correct'
              : index === chosen
                ? 'quiz__choice--wrong'
                : ''
          return (
            <button
              key={choice}
              type="button"
              className={`quiz__choice ${state}`}
              disabled={isAnswered}
              aria-pressed={chosen === index}
              onClick={() => onChoose(index)}
            >
              {choice}
            </button>
          )
        })}
      </div>
      {isAnswered && (
        <p className="quiz__feedback" role="status">
          {isCorrect ? 'Correct. ' : 'Not quite. '}
          {question.explanation}{' '}
          <button type="button" onClick={onHearSource}>
            Hear it in the lecture
          </button>
        </p>
      )}
    </li>
  )
}

interface QuizViewProps {
  readonly quiz: Quiz
  readonly transcript: Transcript
  readonly onSeek: (ms: number) => void
}

export const QuizView = ({ quiz, transcript, onSeek }: QuizViewProps) => {
  const [answers, setAnswers] = useState<QuizAnswers>({})
  const score = scoreQuiz(quiz.questions, answers)

  return (
    <section className="study-aid" aria-label="Quiz">
      <h3>Quiz</h3>
      <ol className="quiz">
        {quiz.questions.map((question, position) => (
          <QuestionCard
            key={question.id}
            question={question}
            position={position}
            chosen={answers[question.id]}
            onChoose={(choice) => setAnswers((current) => ({ ...current, [question.id]: choice }))}
            onHearSource={() =>
              onSeek(transcript.segments[question.sourceSegmentIndex]?.startMs ?? 0)
            }
          />
        ))}
      </ol>
      <p className="quiz__score" aria-live="polite">
        Score: {score.correct} / {score.answered} answered ({score.total} questions)
      </p>
      {score.answered > 0 && (
        <button type="button" onClick={() => setAnswers({})}>
          Retake
        </button>
      )}
    </section>
  )
}
