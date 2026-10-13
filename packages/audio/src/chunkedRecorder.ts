/** The subset of the browser MediaRecorder API this module depends on. */
export interface MediaRecorderLike {
  readonly state: RecordingState
  ondataavailable: ((event: BlobEvent) => void) | null
  onstop: ((event: Event) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
  start(timeslice?: number): void
  pause(): void
  resume(): void
  stop(): void
}

export interface RecordedChunk {
  readonly index: number
  readonly blob: Blob
  /** Active (non-paused) recording time covered by this chunk. */
  readonly durationMs: number
}

export interface ChunkedRecorderOptions {
  readonly mediaRecorder: MediaRecorderLike
  readonly timesliceMs: number
  /** Must durably persist the chunk; the next chunk is not handed over until it resolves. */
  readonly onChunk: (chunk: RecordedChunk) => Promise<void>
  readonly now?: () => number
}

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'] as const

/** Chrome/Firefox record WebM/Ogg Opus, Safari records MP4; pick what the browser supports. */
export const pickSupportedMimeType = (
  isTypeSupported: (type: string) => boolean,
): string | undefined => MIME_CANDIDATES.find((type) => isTypeSupported(type))

/**
 * Wraps MediaRecorder so that every chunk is handed to `onChunk` exactly once, in order,
 * with a contiguous index and its active duration (paused time excluded).
 */
export class ChunkedRecorder {
  private readonly now: () => number
  private nextIndex = 0
  private activeSinceLastChunkMs = 0
  private segmentStartedAt: number | null = null
  private queue: Promise<void> = Promise.resolve()
  private failure: Error | undefined
  private started = false

  constructor(private readonly options: ChunkedRecorderOptions) {
    this.now = options.now ?? (() => performance.now())
    const { mediaRecorder } = options
    mediaRecorder.ondataavailable = (event) => this.handleData(event.data)
    mediaRecorder.onerror = (event) => {
      this.failure ??= new Error(`Media recorder failed: ${event.message || event.type}`)
    }
  }

  start(): void {
    if (this.started) throw new Error('Recorder has already been started')
    this.started = true
    this.segmentStartedAt = this.now()
    this.options.mediaRecorder.start(this.options.timesliceMs)
  }

  pause(): void {
    if (this.options.mediaRecorder.state !== 'recording') return
    this.closeSegment()
    this.options.mediaRecorder.pause()
  }

  resume(): void {
    if (this.options.mediaRecorder.state !== 'paused') return
    this.segmentStartedAt = this.now()
    this.options.mediaRecorder.resume()
  }

  /** Stops recording and resolves once the final chunk has been persisted. */
  async stop(): Promise<void> {
    const { mediaRecorder } = this.options
    if (mediaRecorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        mediaRecorder.onstop = () => resolve()
        mediaRecorder.stop()
      })
    }
    await this.queue
    if (this.failure) throw this.failure
  }

  private closeSegment(): void {
    if (this.segmentStartedAt === null) return
    this.activeSinceLastChunkMs += this.now() - this.segmentStartedAt
    this.segmentStartedAt = null
  }

  private takeChunkDuration(): number {
    const isRecording = this.segmentStartedAt !== null
    this.closeSegment()
    const duration = Math.round(this.activeSinceLastChunkMs)
    this.activeSinceLastChunkMs = 0
    if (isRecording) this.segmentStartedAt = this.now()
    return duration
  }

  private handleData(blob: Blob): void {
    const durationMs = this.takeChunkDuration()
    if (blob.size === 0) {
      this.activeSinceLastChunkMs += durationMs
      return
    }
    // Index and duration are fixed synchronously, so order never depends on write timing.
    const chunk: RecordedChunk = { index: this.nextIndex, blob, durationMs }
    this.nextIndex += 1
    this.queue = this.queue.then(async () => {
      // After a failed write, later chunks are not written: indices must stay contiguous.
      if (this.failure) return
      try {
        await this.options.onChunk(chunk)
      } catch (error) {
        this.failure = error instanceof Error ? error : new Error(String(error))
      }
    })
  }
}
