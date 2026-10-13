import { describe, expect, test } from 'vitest'
import { formatTimestamp } from './formatTimestamp'

describe('formatTimestamp', () => {
  test('formats under an hour as m:ss', () => {
    expect(formatTimestamp(0)).toBe('0:00')
    expect(formatTimestamp(65_400)).toBe('1:05')
  })

  test('formats an hour or more as h:mm:ss', () => {
    expect(formatTimestamp(3_725_000)).toBe('1:02:05')
  })

  test('clamps negative values to zero', () => {
    expect(formatTimestamp(-500)).toBe('0:00')
  })
})
