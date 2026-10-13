import { describe, expect, test } from 'vitest'
import { findSegmentIndexAt, notesBetween } from './timeline'
import type { Note, TranscriptSegment } from './schemas'

const segments: TranscriptSegment[] = [
  { startMs: 0, endMs: 2_000, text: 'first' },
  { startMs: 2_000, endMs: 5_000, text: 'second' },
  { startMs: 7_000, endMs: 9_000, text: 'third' },
]

describe('findSegmentIndexAt', () => {
  test('finds the segment containing the time', () => {
    expect(findSegmentIndexAt(segments, 0)).toBe(0)
    expect(findSegmentIndexAt(segments, 1_999)).toBe(0)
    expect(findSegmentIndexAt(segments, 2_000)).toBe(1)
    expect(findSegmentIndexAt(segments, 8_500)).toBe(2)
  })

  test('returns -1 inside a silence gap or outside the transcript', () => {
    expect(findSegmentIndexAt(segments, 6_000)).toBe(-1)
    expect(findSegmentIndexAt(segments, 9_000)).toBe(-1)
    expect(findSegmentIndexAt(segments, -5)).toBe(-1)
    expect(findSegmentIndexAt([], 100)).toBe(-1)
  })

  test('stays fast on a 3-hour transcript (binary search)', () => {
    const many = Array.from({ length: 50_000 }, (_, index) => ({
      startMs: index * 200,
      endMs: index * 200 + 200,
      text: `w${index}`,
    }))

    expect(findSegmentIndexAt(many, 9_999_950)).toBe(49_999)
  })
})

describe('notesBetween', () => {
  const notes: Note[] = [
    { id: 'a', atMs: 1_000, kind: 'text', text: 'a' },
    { id: 'b', atMs: 3_000, kind: 'question', text: 'b' },
    { id: 'c', atMs: 8_000, kind: 'heading', text: 'c' },
  ]

  test('returns notes in the half-open range [from, to)', () => {
    expect(notesBetween(notes, 1_000, 8_000).map((note) => note.id)).toEqual(['a', 'b'])
  })

  test('returns an empty list when the range is empty or inverted', () => {
    expect(notesBetween(notes, 5_000, 5_000)).toEqual([])
    expect(notesBetween(notes, 9_000, 1_000)).toEqual([])
  })
})
