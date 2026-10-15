import { z } from 'zod'
import { errorFromResponse, networkError, ProviderError } from './providerError'

const ENDPOINT = 'https://api.openai.com/v1/chat/completions'
const PROVIDER_NAME = 'OpenAI'
/** Small, inexpensive and good at structured output; override per call site if needed. */
export const DEFAULT_OPENAI_CHAT_MODEL = 'gpt-4.1-mini'
const TEMPERATURE = 0.2

export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant'
  readonly content: string
}

/** A model that answers with a single JSON object. Callers validate the shape themselves. */
export interface JsonChatClient {
  readonly model: string
  completeJson(messages: readonly ChatMessage[], signal?: AbortSignal): Promise<unknown>
}

const ChatCompletionSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
})

export interface OpenAiChatClientOptions {
  readonly apiKey: string
  readonly model?: string
  readonly fetchFn?: typeof fetch
}

export class OpenAiChatClient implements JsonChatClient {
  readonly model: string
  private readonly fetchFn: typeof fetch

  constructor(private readonly options: OpenAiChatClientOptions) {
    this.model = options.model ?? DEFAULT_OPENAI_CHAT_MODEL
    this.fetchFn = options.fetchFn ?? ((input, init) => fetch(input, init))
  }

  async completeJson(messages: readonly ChatMessage[], signal?: AbortSignal): Promise<unknown> {
    const response = await this.send(messages, signal)
    if (!response.ok) {
      throw await errorFromResponse(response, {
        apiKey: this.options.apiKey,
        providerName: PROVIDER_NAME,
      })
    }
    const parsed = ChatCompletionSchema.safeParse(await response.json().catch(() => undefined))
    if (!parsed.success) {
      throw new ProviderError('invalid-response', 'OpenAI returned an unexpected response.', {
        cause: parsed.error,
      })
    }
    const content = parsed.data.choices[0]?.message.content ?? ''
    try {
      return JSON.parse(content) as unknown
    } catch (cause) {
      throw new ProviderError('invalid-json', 'The model did not return valid JSON.', {
        cause,
        rawOutput: content,
      })
    }
  }

  private async send(messages: readonly ChatMessage[], signal?: AbortSignal): Promise<Response> {
    try {
      return await this.fetchFn(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          temperature: TEMPERATURE,
          response_format: { type: 'json_object' },
          messages,
        }),
        ...(signal ? { signal } : {}),
      })
    } catch (cause) {
      throw networkError(PROVIDER_NAME, cause)
    }
  }
}
