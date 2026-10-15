import type { Transcript } from '@earmark/core'
import { describe, expect, test } from 'vitest'
import { GenerationError } from './generateValidated'
import { ScriptedClient } from './scriptedClient.testkit'
import { formatTranscriptForPrompt, generateOutline, generateQuiz } from './studyAidGenerators'

const NOW = () => '2026-10-15T12:00:00.000Z'

const transcript: Transcript = {
  provider: 'openai',
  model: 'whisper-1',
  language: 'english',
  createdAt: '2026-10-15T11:00:00.000Z',
  segments: [
    { startMs: 0, endMs: 3_000, text: 'Today we study cells.' },
    { startMs: 3_000, endMs: 8_000, text: 'Mitochondria produce ATP.' },
    { startMs: 8_000, endMs: 12_000, text: 'Next, the nucleus stores DNA.' },
  ],
}

const question = {
  question: 'What produces ATP?',
  choices: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi'],
  correctIndex: 1,
  explanation: 'The lecture says mitochondria produce ATP.',
  sourceSegmentIndex: 1,
}

describe('formatTranscriptForPrompt', () => {
  test('numbers every segment so the model can cite positions', () => {
    expect(formatTranscriptForPrompt(transcript)).toBe(
      '[0] Today we study cells.\n[1] Mitochondria produce ATP.\n[2] Next, the nucleus stores DNA.',
    )
  })
})

describe('generateOutline', () => {
  test('returns a grounded outline stamped with model and time', async () => {
    const client = new ScriptedClient([
      {
        sections: [
          { title: 'Nucleus', summary: 'Stores DNA.', startSegmentIndex: 2 },
          { title: 'Cells and energy', summary: 'Mitochondria.', startSegmentIndex: 0 },
        ],
      },
    ])

    const outline = await generateOutline({ client, transcript, now: NOW })

    expect(outline).toEqual({
      model: 'scripted-model',
      createdAt: '2026-10-15T12:00:00.000Z',
      sections: [
        { title: 'Cells and energy', summary: 'Mitochondria.', startSegmentIndex: 0 },
        { title: 'Nucleus', summary: 'Stores DNA.', startSegmentIndex: 2 },
      ],
    })
  })

  test('sends the numbered transcript and asks for the transcript language', async () => {
    const client = new ScriptedClient([
      { sections: [{ title: 'A', summary: 'b', startSegmentIndex: 0 }] },
    ])

    await generateOutline({ client, transcript, now: NOW })

    const prompt = client.calls[0]?.map((message) => message.content).join('\n') ?? ''
    expect(prompt).toContain('[1] Mitochondria produce ATP.')
    expect(prompt).toMatch(/english/i)
  })

  test('asks for a repair when every section points outside the transcript', async () => {
    const client = new ScriptedClient([
      { sections: [{ title: 'Ghost', summary: 'x', startSegmentIndex: 99 }] },
      { sections: [{ title: 'Real', summary: 'y', startSegmentIndex: 1 }] },
    ])

    const outline = await generateOutline({ client, transcript, now: NOW })

    expect(outline.sections.map((section) => section.title)).toEqual(['Real'])
    expect(client.calls).toHaveLength(2)
  })

  test('refuses an empty transcript without calling the model', async () => {
    const client = new ScriptedClient([])

    await expect(
      generateOutline({ client, transcript: { ...transcript, segments: [] }, now: NOW }),
    ).rejects.toBeInstanceOf(GenerationError)
    expect(client.calls).toHaveLength(0)
  })
})

describe('generateQuiz', () => {
  test('returns grounded questions and reports how many were dropped', async () => {
    const ungrounded = { ...question, sourceSegmentIndex: 7 }
    const client = new ScriptedClient([{ questions: [question, ungrounded] }])

    const { quiz, droppedCount } = await generateQuiz({
      client,
      transcript,
      questionCount: 2,
      now: NOW,
    })

    expect(quiz.questions).toEqual([{ ...question, id: 'q1' }])
    expect(quiz.model).toBe('scripted-model')
    expect(droppedCount).toBe(1)
  })

  test('asks for the requested number of questions', async () => {
    const client = new ScriptedClient([{ questions: [question] }])

    await generateQuiz({ client, transcript, questionCount: 7, now: NOW })

    expect(client.calls[0]?.at(-1)?.content).toMatch(/7 multiple-choice questions/)
  })
})
