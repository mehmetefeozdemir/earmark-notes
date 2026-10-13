import { describe, expect, test, vi } from 'vitest'
import {
  ChunkedRecorder,
  pickSupportedMimeType,
  type MediaRecorderLike,
  type RecordedChunk,
} from './chunkedRecorder'

/** Test double driven by hand: tests decide when data arrives and when time passes. */
class FakeMediaRecorder implements MediaRecorderLike {
  state: RecordingState = 'inactive'
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  onerror: ((event: Event) => void) | null = null
  timeslice: number | undefined

  start(timeslice?: number): void {
    this.state = 'recording'
    this.timeslice = timeslice
  }
  pause(): void {
    this.state = 'paused'
  }
  resume(): void {
    this.state = 'recording'
  }
  stop(): void {
    this.state = 'inactive'
    this.emit('final')
    this.onstop?.()
  }
  emit(text: string): void {
    this.ondataavailable?.({ data: new Blob([text]) })
  }
}

const setup = (onChunk: (chunk: RecordedChunk) => Promise<void> = () => Promise.resolve()) => {
  let clock = 0
  const fake = new FakeMediaRecorder()
  const recorder = new ChunkedRecorder({
    mediaRecorder: fake,
    timesliceMs: 5_000,
    onChunk,
    now: () => clock,
  })
  const advance = (ms: number) => {
    clock += ms
  }
  return { fake, recorder, advance }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('ChunkedRecorder', () => {
  test('starts the media recorder with the configured timeslice', () => {
    const { fake, recorder } = setup()

    recorder.start()

    expect(fake.state).toBe('recording')
    expect(fake.timeslice).toBe(5_000)
  })

  test('numbers chunks and measures their duration', async () => {
    const chunks: RecordedChunk[] = []
    const { fake, recorder, advance } = setup(async (chunk) => {
      chunks.push(chunk)
    })

    recorder.start()
    advance(5_000)
    fake.emit('a')
    advance(3_000)
    await recorder.stop()

    expect(chunks.map(({ index, durationMs }) => ({ index, durationMs }))).toEqual([
      { index: 0, durationMs: 5_000 },
      { index: 1, durationMs: 3_000 },
    ])
  })

  test('excludes paused time from chunk durations', async () => {
    const chunks: RecordedChunk[] = []
    const { fake, recorder, advance } = setup(async (chunk) => {
      chunks.push(chunk)
    })

    recorder.start()
    advance(2_000)
    recorder.pause()
    advance(60_000)
    recorder.resume()
    advance(1_000)
    fake.emit('a')
    await recorder.stop()

    expect(chunks[0]?.durationMs).toBe(3_000)
    expect(fake.state).toBe('inactive')
  })

  test('handles chunks strictly one after another, in order', async () => {
    const order: string[] = []
    let releaseFirst: () => void = () => undefined
    const { fake, recorder } = setup(async (chunk) => {
      order.push(`start-${chunk.index}`)
      if (chunk.index === 0) await new Promise<void>((resolve) => (releaseFirst = resolve))
      order.push(`end-${chunk.index}`)
    })

    recorder.start()
    fake.emit('a')
    fake.emit('b')
    await flush()
    expect(order).toEqual(['start-0'])

    releaseFirst()
    await recorder.stop()

    expect(order).toEqual(['start-0', 'end-0', 'start-1', 'end-1', 'start-2', 'end-2'])
  })

  test('skips empty chunks without consuming an index', async () => {
    const indices: number[] = []
    const { fake, recorder } = setup(async (chunk) => {
      indices.push(chunk.index)
    })

    recorder.start()
    fake.ondataavailable?.({ data: new Blob([]) })
    fake.emit('a')
    await recorder.stop()

    expect(indices).toEqual([0, 1])
  })

  test('stop() rejects when persisting a chunk failed', async () => {
    const { fake, recorder } = setup(() => Promise.reject(new Error('disk full')))

    recorder.start()
    fake.emit('a')

    await expect(recorder.stop()).rejects.toThrow('disk full')
  })

  test('reports media recorder errors through stop()', async () => {
    const { fake, recorder } = setup()

    recorder.start()
    fake.onerror?.(new Event('error'))

    await expect(recorder.stop()).rejects.toThrow(/media recorder/i)
  })

  test('cannot be started twice', () => {
    const { recorder } = setup()
    recorder.start()

    expect(() => recorder.start()).toThrow(/already/)
  })
})

describe('pickSupportedMimeType', () => {
  test('returns the first supported candidate', () => {
    const supported = vi.fn((type: string) => type === 'audio/mp4')

    expect(pickSupportedMimeType(supported)).toBe('audio/mp4')
  })

  test('returns undefined when nothing is supported, letting the browser choose', () => {
    expect(pickSupportedMimeType(() => false)).toBeUndefined()
  })
})
