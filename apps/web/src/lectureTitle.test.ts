import { describe, expect, test } from 'vitest'
import { defaultLectureTitle } from './lectureTitle'

describe('defaultLectureTitle', () => {
  test('names a new lecture after its date so lectures are easy to tell apart', () => {
    expect(defaultLectureTitle(new Date('2026-10-16T09:30:00Z'))).toBe('Lecture · 16 Oct 2026')
  })
})
