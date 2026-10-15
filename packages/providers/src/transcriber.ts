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

/** Transcription failures use the shared provider error type. */
export {
  ProviderError as TranscriptionError,
  type ProviderErrorKind as TranscriptionErrorKind,
} from './providerError'
