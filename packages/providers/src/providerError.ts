import { z } from 'zod'

export type ProviderErrorKind =
  | 'invalid-key'
  | 'rate-limited'
  | 'too-large'
  | 'network'
  | 'provider-error'
  | 'invalid-response'
  | 'model-unavailable'
  | 'invalid-json'

export interface ProviderErrorOptions extends ErrorOptions {
  /** Raw model output, kept so a repair prompt can show the model what it got wrong. */
  readonly rawOutput?: string
}

/** A provider failure classified by what the user can do about it. */
export class ProviderError extends Error {
  override readonly name = 'ProviderError'
  readonly rawOutput: string | undefined

  constructor(
    readonly kind: ProviderErrorKind,
    message: string,
    options?: ProviderErrorOptions,
  ) {
    super(message, options)
    this.rawOutput = options?.rawOutput
  }
}

const STATUS_KIND: Readonly<Record<number, ProviderErrorKind>> = {
  401: 'invalid-key',
  403: 'invalid-key',
  404: 'model-unavailable',
  413: 'too-large',
  429: 'rate-limited',
}

const ProviderErrorBodySchema = z.object({ error: z.object({ message: z.string() }) })

/** Removes every occurrence of the key; providers sometimes echo it back in errors. */
export const redactSecret = (text: string, secret: string): string =>
  secret ? text.split(secret).join('[redacted]') : text

export const errorFromResponse = async (
  response: Response,
  { apiKey, providerName }: { readonly apiKey: string; readonly providerName: string },
): Promise<ProviderError> => {
  const kind = STATUS_KIND[response.status] ?? 'provider-error'
  const body: unknown = await response.json().catch(() => undefined)
  const parsed = ProviderErrorBodySchema.safeParse(body)
  const detail = parsed.success ? parsed.data.error.message : response.statusText
  return new ProviderError(
    kind,
    `${providerName} ${response.status}: ${redactSecret(detail, apiKey)}`,
  )
}

export const networkError = (providerName: string, cause: unknown): ProviderError =>
  new ProviderError('network', `Could not reach ${providerName}. Check your connection.`, {
    cause,
  })
