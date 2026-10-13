import {
  appendChunk,
  startRecordingDraft,
  type Recording,
  type RecordingDraft,
  type StartRecordingDraftInput,
} from '@lecture-notes/core'
import type { AudioChunkStore } from './audioChunkStore'
import type { RecordingDraftRepository } from './recordingDraftRepository'
import { commitDraft, discardDraft } from './recovery'
import type { SessionRepository } from './sessionRepository'

export interface RecordingWriterDependencies {
  readonly sessions: SessionRepository
  readonly drafts: RecordingDraftRepository
  readonly chunks: AudioChunkStore
}

export interface ChunkToWrite {
  readonly index: number
  readonly blob: Blob
  readonly durationMs: number
}

/**
 * Persists a recording while it happens. Write order per chunk is
 * audio file first, then draft metadata, so the draft never references missing audio.
 */
export class RecordingWriter {
  private constructor(
    private draft: RecordingDraft,
    private readonly deps: RecordingWriterDependencies,
  ) {}

  static async begin(
    input: StartRecordingDraftInput,
    deps: RecordingWriterDependencies,
  ): Promise<RecordingWriter> {
    const draft = startRecordingDraft(input)
    await deps.drafts.save(draft)
    return new RecordingWriter(draft, deps)
  }

  get recordingId(): string {
    return this.draft.recordingId
  }

  async writeChunk({ index, blob, durationMs }: ChunkToWrite): Promise<void> {
    const next = appendChunk(this.draft, { index, durationMs, bytes: blob.size })
    await this.deps.chunks.write(this.draft.recordingId, index, blob)
    await this.deps.drafts.save(next)
    this.draft = next
  }

  /** Attaches the recording to its session; returns undefined if no audio was captured. */
  async finish(now: string): Promise<Recording | undefined> {
    if (this.draft.chunks.length === 0) {
      await discardDraft(this.deps, this.draft.recordingId)
      return undefined
    }
    return commitDraft({ ...this.deps, now }, this.draft)
  }
}
