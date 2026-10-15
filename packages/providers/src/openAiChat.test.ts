import { describe, expect, test, vi } from 'vitest'
import { OpenAiChatClient } from './openAiChat'
import { ProviderError } from './providerError'

const KEY = 'sk-test-chat-key-0000'

const chatResponse = (content: string, status = 200): Response =>
  new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const errorResponse = (status: number, message = 'nope'): Response =>
  new Response(JSON.stringify({ error: { message } }), { status })

const setup = (response: Response | Error, model?: string) => {
  const fetchFn = vi.fn<typeof fetch>(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  )
  const client = new OpenAiChatClient({ apiKey: KEY, fetchFn, ...(model ? { model } : {}) })
  return { fetchFn, client }
}

const messages = [
  { role: 'system' as const, content: 'Reply in JSON.' },
  { role: 'user' as const, content: 'Hi' },
]

describe('OpenAiChatClient', () => {
  test('requests JSON output from the chat completions endpoint', async () => {
    const { fetchFn, client } = setup(chatResponse('{"ok":true}'))

    await client.completeJson(messages)

    const [url, init] = fetchFn.mock.calls[0] ?? []
    expect(url).toBe('https://api.openai.com/v1/chat/completions')
    expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${KEY}`)
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>
    expect(body).toMatchObject({
      model: 'gpt-4.1-mini',
      response_format: { type: 'json_object' },
      messages,
    })
  })

  test('uses a custom model when given', async () => {
    const { fetchFn, client } = setup(chatResponse('{}'), 'gpt-custom')

    await client.completeJson(messages)

    expect(JSON.parse(String(fetchFn.mock.calls[0]?.[1]?.body)).model).toBe('gpt-custom')
    expect(client.model).toBe('gpt-custom')
  })

  test('returns the parsed JSON content', async () => {
    const { client } = setup(chatResponse('{"sections":[{"title":"Intro"}]}'))

    expect(await client.completeJson(messages)).toEqual({ sections: [{ title: 'Intro' }] })
  })

  test('reports content that is not JSON as invalid-json, keeping the raw text', async () => {
    const { client } = setup(chatResponse('Sure! Here is your outline:'))

    const error = (await client
      .completeJson(messages)
      .catch((caught: unknown) => caught)) as ProviderError

    expect(error).toBeInstanceOf(ProviderError)
    expect(error.kind).toBe('invalid-json')
    expect(error.rawOutput).toBe('Sure! Here is your outline:')
  })

  test.each([
    [401, 'invalid-key'],
    [404, 'model-unavailable'],
    [429, 'rate-limited'],
    [500, 'provider-error'],
  ] as const)('maps HTTP %i to %s', async (status, kind) => {
    const { client } = setup(errorResponse(status))

    await expect(client.completeJson(messages)).rejects.toMatchObject({ kind })
  })

  test('reports network failures', async () => {
    const { client } = setup(new TypeError('Failed to fetch'))

    await expect(client.completeJson(messages)).rejects.toMatchObject({ kind: 'network' })
  })

  test('rejects a response without a message', async () => {
    const { client } = setup(new Response(JSON.stringify({ choices: [] }), { status: 200 }))

    await expect(client.completeJson(messages)).rejects.toMatchObject({ kind: 'invalid-response' })
  })

  test('redacts the API key from provider error messages', async () => {
    const { client } = setup(errorResponse(401, `Incorrect API key provided: ${KEY}`))

    const error = (await client.completeJson(messages).catch((caught: unknown) => caught)) as Error

    expect(error.message).not.toContain(KEY)
  })
})
