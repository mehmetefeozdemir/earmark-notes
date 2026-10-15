import { TranscriptionError } from '@earmark/providers'
import { describe, expect, test } from 'vitest'
import { maskApiKey, transcriptionErrorMessage } from './transcriptionText'

describe('maskApiKey', () => {
  test('shows only the last four characters', () => {
    expect(maskApiKey('sk-proj-abcdefghijklmnop1234')).toBe('••••1234')
  })

  test('reveals nothing for very short values', () => {
    expect(maskApiKey('abc')).toBe('••••')
  })
})

describe('transcriptionErrorMessage', () => {
  test.each([
    ['invalid-key', /check your openai api key/i],
    ['rate-limited', /rate limit|quota/i],
    ['too-large', /too long/i],
    ['network', /connection/i],
    ['invalid-response', /unexpected/i],
    ['provider-error', /openai/i],
  ] as const)('explains %s errors in user terms', (kind, pattern) => {
    expect(transcriptionErrorMessage(new TranscriptionError(kind, 'raw detail'))).toMatch(pattern)
  })

  test('falls back to a generic message for unknown errors', () => {
    expect(transcriptionErrorMessage(new Error('boom'))).toBe('Transcription failed: boom')
    expect(transcriptionErrorMessage('weird')).toBe('Transcription failed.')
  })
})
