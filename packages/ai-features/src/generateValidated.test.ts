import { ProviderError, type ChatMessage } from '@earmark/providers'
import { describe, expect, test } from 'vitest'
import { z } from 'zod'
import { GenerationError, generateValidated } from './generateValidated'
import { ScriptedClient } from './scriptedClient.testkit'

const Schema = z.object({ answer: z.number().int() })

const messages: ChatMessage[] = [
  { role: 'system', content: 'Answer as JSON.' },
  { role: 'user', content: 'What is 6 * 7?' },
]

const invalidJson = (raw: string) =>
  new ProviderError('invalid-json', 'The model did not return valid JSON.', { rawOutput: raw })

describe('generateValidated', () => {
  test('returns the first answer that matches the schema', async () => {
    const client = new ScriptedClient([{ answer: 42 }])

    expect(await generateValidated({ client, messages, schema: Schema })).toEqual({ answer: 42 })
    expect(client.calls).toHaveLength(1)
  })

  test('asks the model to repair an answer that fails validation, quoting the problem', async () => {
    const client = new ScriptedClient([{ answer: 'forty-two' }, { answer: 42 }])

    const result = await generateValidated({ client, messages, schema: Schema })

    expect(result).toEqual({ answer: 42 })
    const repairTurn = client.calls[1] ?? []
    expect(repairTurn.slice(0, 2)).toEqual(messages)
    expect(repairTurn[2]).toEqual({ role: 'assistant', content: '{"answer":"forty-two"}' })
    expect(repairTurn[3]?.role).toBe('user')
    expect(repairTurn[3]?.content).toMatch(/answer/)
  })

  test('repairs output that was not JSON at all, showing the model its raw text', async () => {
    const client = new ScriptedClient([invalidJson('Sure! The answer is 42.'), { answer: 42 }])

    await generateValidated({ client, messages, schema: Schema })

    expect(client.calls[1]?.[2]).toEqual({ role: 'assistant', content: 'Sure! The answer is 42.' })
  })

  test('gives up after the allowed number of repairs', async () => {
    const client = new ScriptedClient([{ answer: 'a' }, { answer: 'b' }, { answer: 'c' }])

    const error = await generateValidated({
      client,
      messages,
      schema: Schema,
      maxRepairs: 2,
    }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(GenerationError)
    expect(client.calls).toHaveLength(3)
  })

  test('does not retry provider failures such as a bad key', async () => {
    const client = new ScriptedClient([new ProviderError('invalid-key', 'OpenAI 401')])

    await expect(generateValidated({ client, messages, schema: Schema })).rejects.toMatchObject({
      kind: 'invalid-key',
    })
    expect(client.calls).toHaveLength(1)
  })

  test('accepts extra domain checks and repairs when they fail', async () => {
    const client = new ScriptedClient([{ answer: 41 }, { answer: 42 }])
    const mustBe42 = (value: { answer: number }) => {
      if (value.answer !== 42) throw new Error('answer must be 42')
      return value
    }

    const result = await generateValidated({ client, messages, schema: Schema, refine: mustBe42 })

    expect(result).toEqual({ answer: 42 })
    expect(client.calls[1]?.[3]?.content).toMatch(/answer must be 42/)
  })
})
