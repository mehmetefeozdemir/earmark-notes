import type { Transcript } from '@earmark/core'

export interface TranscribeOptions {
  /** ISO-639-1 code (e.g. "en", "tr"); omit to let the provider detect it. */
  readonly language?: string
  readonly signal?: AbortSignal
}

/** Speech-to-text for a complete recording. Implementations must never log the API key. */
export interface BatchTranscriber {
  readonly providerId: string
  readonly maxUploadBytes: number
  transcribe(audio: Blob, options?: TranscribeOptions): Promise<Transcript>
}

export type TranscriptionErrorKind =
  'invalid-key' | 'rate-limited' | 'too-large' | 'network' | 'provider-error' | 'invalid-response'

/** A failure the UI can explain to the user, classified by what they can do about it. */
export class TranscriptionError extends Error {
  override readonly name = 'TranscriptionError'

  constructor(
    readonly kind: TranscriptionErrorKind,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
  }
}
