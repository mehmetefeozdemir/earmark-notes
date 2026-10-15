import { describe, expect, test, vi } from 'vitest'
import { OpenAiTranscriber, OPENAI_MAX_UPLOAD_BYTES } from './openAiTranscriber'
import { TranscriptionError } from './transcriber'

const KEY = 'sk-test-not-a-real-key'
const NOW = () => '2026-10-15T12:00:00.000Z'

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const verboseJson = {
  language: 'english',
  duration: 7.5,
  text: 'Hello class. Today we cover cells.',
  segments: [
    { id: 0, start: 0, end: 2.4, text: ' Hello class.' },
    { id: 1, start: 2.4, end: 7.5, text: ' Today we cover cells.' },
  ],
}

const setup = (response: Response | Error) => {
  const fetchFn = vi.fn<typeof fetch>(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  )
  const transcriber = new OpenAiTranscriber({ apiKey: KEY, fetchFn, now: NOW })
  return { fetchFn, transcriber }
}

const audio = () => new Blob(['fake-audio'], { type: 'audio/webm;codecs=opus' })

describe('OpenAiTranscriber', () => {
  test('sends the audio to the transcription endpoint with the key and segment timestamps', async () => {
    const { fetchFn, transcriber } = setup(jsonResponse(200, verboseJson))

    await transcriber.transcribe(audio(), { language: 'en' })

    const [url, init] = fetchFn.mock.calls[0] ?? []
    expect(url).toBe('https://api.openai.com/v1/audio/transcriptions')
    expect(init?.method).toBe('POST')
    expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${KEY}`)
    const form = init?.body as FormData
    expect(form.get('model')).toBe('whisper-1')
    expect(form.get('response_format')).toBe('verbose_json')
    expect(form.getAll('timestamp_granularities[]')).toEqual(['segment'])
    expect(form.get('language')).toBe('en')
    expect((form.get('file') as File).name).toBe('recording.webm')
  })

  test('maps segments to millisecond, trimmed transcript segments', async () => {
    const { transcriber } = setup(jsonResponse(200, verboseJson))

    const transcript = await transcriber.transcribe(audio())

    expect(transcript).toEqual({
      provider: 'openai',
      model: 'whisper-1',
      language: 'english',
      createdAt: '2026-10-15T12:00:00.000Z',
      segments: [
        { startMs: 0, endMs: 2_400, text: 'Hello class.' },
        { startMs: 2_400, endMs: 7_500, text: 'Today we cover cells.' },
      ],
    })
  })

  test('names the uploaded file after the audio format so the API can decode it', async () => {
    const { fetchFn, transcriber } = setup(jsonResponse(200, verboseJson))

    await transcriber.transcribe(new Blob(['x'], { type: 'audio/mp4' }))

    const form = fetchFn.mock.calls[0]?.[1]?.body as FormData
    expect((form.get('file') as File).name).toBe('recording.mp4')
  })

  test.each([
    [401, 'invalid-key'],
    [429, 'rate-limited'],
    [413, 'too-large'],
    [500, 'provider-error'],
  ] as const)('maps HTTP %i to a %s error', async (status, kind) => {
    const { transcriber } = setup(jsonResponse(status, { error: { message: 'nope' } }))

    const error = await transcriber.transcribe(audio()).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(TranscriptionError)
    expect((error as TranscriptionError).kind).toBe(kind)
  })

  test('reports network failures distinctly', async () => {
    const { transcriber } = setup(new TypeError('Failed to fetch'))

    await expect(transcriber.transcribe(audio())).rejects.toMatchObject({ kind: 'network' })
  })

  test('rejects an unexpected response shape instead of trusting it', async () => {
    const { transcriber } = setup(jsonResponse(200, { text: 'no segments here' }))

    await expect(transcriber.transcribe(audio())).rejects.toMatchObject({
      kind: 'invalid-response',
    })
  })

  test('refuses audio over the upload limit before sending anything', async () => {
    const { fetchFn, transcriber } = setup(jsonResponse(200, verboseJson))
    const huge = { size: OPENAI_MAX_UPLOAD_BYTES + 1, type: 'audio/webm' } as Blob

    await expect(transcriber.transcribe(huge)).rejects.toMatchObject({ kind: 'too-large' })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  test('never includes the API key in error messages', async () => {
    const { transcriber } = setup(jsonResponse(401, { error: { message: `bad key ${KEY}` } }))

    const error = (await transcriber
      .transcribe(audio())
      .catch((caught: unknown) => caught)) as Error

    expect(error.message).not.toContain(KEY)
  })
})
