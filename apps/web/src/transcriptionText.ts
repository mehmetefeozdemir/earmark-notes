import { TranscriptionError, type TranscriptionErrorKind } from '@earmark/providers'

const VISIBLE_KEY_CHARS = 4
const MASK = '••••'

/** Shows enough of a key to recognise it, never enough to reuse it. */
export const maskApiKey = (key: string): string =>
  key.length > VISIBLE_KEY_CHARS * 2 ? `${MASK}${key.slice(-VISIBLE_KEY_CHARS)}` : MASK

const MESSAGES: Readonly<Record<TranscriptionErrorKind, string>> = {
  'invalid-key': 'OpenAI rejected the key. Check your OpenAI API key in AI settings.',
  'rate-limited': 'OpenAI rate limit or quota reached. Wait a minute or check your billing.',
  'too-large': 'This recording is too long for OpenAI (25 MB limit, about 70 minutes).',
  network: 'Could not reach OpenAI. Check your internet connection and try again.',
  'invalid-response': 'OpenAI sent an unexpected response. Please try again.',
  'provider-error': 'OpenAI had a problem transcribing this recording. Please try again later.',
}

export const transcriptionErrorMessage = (error: unknown): string => {
  if (error instanceof TranscriptionError) return MESSAGES[error.kind]
  if (error instanceof Error) return `Transcription failed: ${error.message}`
  return 'Transcription failed.'
}
