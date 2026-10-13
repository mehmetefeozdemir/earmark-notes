import { describe, expect, test } from 'vitest'
import { SessionSchema, TranscriptSegmentSchema } from './schemas'

describe('TranscriptSegmentSchema', () => {
  test('accepts a segment whose end is after its start', () => {
    expect(TranscriptSegmentSchema.safeParse({ startMs: 0, endMs: 10, text: 'hi' }).success).toBe(
      true,
    )
  })

  test('rejects a segment that ends before it starts', () => {
    const result = TranscriptSegmentSchema.safeParse({ startMs: 10, endMs: 5, text: 'x' })

    expect(result.success).toBe(false)
  })
})

describe('SessionSchema', () => {
  test('rejects data from an unknown schema version', () => {
    const result = SessionSchema.safeParse({
      schemaVersion: 999,
      id: 's',
      title: 't',
      createdAt: '2026-10-13T09:00:00.000Z',
      updatedAt: '2026-10-13T09:00:00.000Z',
      recordings: [],
      notes: [],
    })

    expect(result.success).toBe(false)
  })
})
