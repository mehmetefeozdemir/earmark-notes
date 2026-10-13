import { RecordingDraftSchema, type RecordingDraft } from '@lecture-notes/core'
import type { LectureNotesDb } from './db'

export interface RecordingDraftList {
  readonly drafts: readonly RecordingDraft[]
  readonly corruptIds: readonly string[]
}

export interface RecordingDraftRepository {
  save(draft: RecordingDraft): Promise<void>
  list(): Promise<RecordingDraftList>
  delete(recordingId: string): Promise<void>
}

const rowId = (row: unknown): string =>
  typeof row === 'object' && row !== null && 'recordingId' in row
    ? String(row.recordingId)
    : '<unknown>'

/** Drafts of in-progress recordings, written after every chunk. */
export class DexieRecordingDraftRepository implements RecordingDraftRepository {
  constructor(private readonly db: LectureNotesDb) {}

  async save(draft: RecordingDraft): Promise<void> {
    await this.db.recordingDrafts.put(RecordingDraftSchema.parse(draft))
  }

  async list(): Promise<RecordingDraftList> {
    const rows: unknown[] = await this.db.recordingDrafts.toArray()
    const drafts: RecordingDraft[] = []
    const corruptIds: string[] = []
    for (const row of rows) {
      const parsed = RecordingDraftSchema.safeParse(row)
      if (parsed.success) drafts.push(parsed.data)
      else corruptIds.push(rowId(row))
    }
    return { drafts, corruptIds }
  }

  async delete(recordingId: string): Promise<void> {
    await this.db.recordingDrafts.delete(recordingId)
  }
}
