import type { Note, TranscriptSegment } from './schemas'

const NOT_FOUND = -1

/**
 * Binary search for the segment containing `timeMs` (start inclusive, end exclusive).
 * Segments must be sorted by `startMs` and must not overlap.
 */
export const findSegmentIndexAt = (
  segments: readonly TranscriptSegment[],
  timeMs: number,
): number => {
  let low = 0
  let high = segments.length - 1
  while (low <= high) {
    const middle = (low + high) >>> 1
    const segment = segments[middle]
    if (segment === undefined) return NOT_FOUND
    if (timeMs < segment.startMs) high = middle - 1
    else if (timeMs >= segment.endMs) low = middle + 1
    else return middle
  }
  return NOT_FOUND
}

/** Notes whose timestamp falls in the half-open range [fromMs, toMs). */
export const notesBetween = (notes: readonly Note[], fromMs: number, toMs: number): Note[] =>
  notes.filter((note) => note.atMs >= fromMs && note.atMs < toMs)
