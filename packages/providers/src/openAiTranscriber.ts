import type { Transcript } from '@earmark/core'
import { z } from 'zod'
import { errorFromResponse, networkError, ProviderError } from './providerError'
import type { BatchTranscriber, TranscribeOptions } from './transcriber'

const ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions'
const MODEL = 'whisper-1'
const PROVIDER_ID = 'openai'
const PROVIDER_NAME = 'OpenAI'
const MS_PER_SECOND = 1_000
const BYTES_PER_MB = 1024 * 1024

/** OpenAI rejects uploads larger than 25 MB (about 70 minutes at 48 kbps). */
export const OPENAI_MAX_UPLOAD_BYTES = 25 * BYTES_PER_MB

const VerboseTranscriptionSchema = z.object({
  language: z.string().min(2),
  segments: z.array(
    z.object({
      start: z.number().nonnegative(),
      end: z.number().nonnegative(),
      text: z.string(),
    }),
  ),
})

const FILE_EXTENSIONS: Readonly<Record<string, string>> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
}

/** The API infers the codec from the file name, so it must match the audio format. */
const fileNameFor = (mimeType: string): string => {
  const baseType = mimeType.split(';')[0]?.trim() ?? ''
  return `recording.${FILE_EXTENSIONS[baseType] ?? 'webm'}`
}

const toMs = (seconds: number): number => Math.round(seconds * MS_PER_SECOND)

export interface OpenAiTranscriberOptions {
  readonly apiKey: string
  readonly fetchFn?: typeof fetch
  readonly now?: () => string
}

export class OpenAiTranscriber implements BatchTranscriber {
  readonly providerId = PROVIDER_ID
  readonly maxUploadBytes = OPENAI_MAX_UPLOAD_BYTES
  private readonly fetchFn: typeof fetch
  private readonly now: () => string

  constructor(private readonly options: OpenAiTranscriberOptions) {
    this.fetchFn = options.fetchFn ?? ((input, init) => fetch(input, init))
    this.now = options.now ?? (() => new Date().toISOString())
  }

  async transcribe(audio: Blob, { language, signal }: TranscribeOptions = {}): Promise<Transcript> {
    if (audio.size > this.maxUploadBytes) {
      throw new ProviderError(
        'too-large',
        `Recording is ${Math.ceil(audio.size / BYTES_PER_MB)} MB; OpenAI accepts up to 25 MB.`,
      )
    }
    const response = await this.send(audio, language, signal)
    if (!response.ok) {
      throw await errorFromResponse(response, {
        apiKey: this.options.apiKey,
        providerName: PROVIDER_NAME,
      })
    }
    return this.parse(await response.json().catch(() => undefined))
  }

  private async send(
    audio: Blob,
    language: string | undefined,
    signal: AbortSignal | undefined,
  ): Promise<Response> {
    const form = new FormData()
    form.append('file', new File([audio], fileNameFor(audio.type), { type: audio.type }))
    form.append('model', MODEL)
    form.append('response_format', 'verbose_json')
    form.append('timestamp_granularities[]', 'segment')
    if (language) form.append('language', language)
    try {
      return await this.fetchFn(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.options.apiKey}` },
        body: form,
        ...(signal ? { signal } : {}),
      })
    } catch (cause) {
      throw networkError(PROVIDER_NAME, cause)
    }
  }

  private parse(body: unknown): Transcript {
    const parsed = VerboseTranscriptionSchema.safeParse(body)
    if (!parsed.success) {
      throw new ProviderError('invalid-response', 'OpenAI returned an unexpected response.', {
        cause: parsed.error,
      })
    }
    return {
      provider: PROVIDER_ID,
      model: MODEL,
      language: parsed.data.language,
      createdAt: this.now(),
      segments: parsed.data.segments.map((segment) => ({
        startMs: toMs(segment.start),
        endMs: toMs(segment.end),
        text: segment.text.trim(),
      })),
    }
  }
}
