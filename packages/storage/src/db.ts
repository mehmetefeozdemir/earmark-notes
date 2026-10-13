import type { RecordingDraft, Session } from '@lecture-notes/core'
import { Dexie, type EntityTable } from 'dexie'

export const DEFAULT_DB_NAME = 'lecture-notes'

/**
 * IndexedDB schema. Once a version has shipped, never edit it in place:
 * add a new version (with an upgrade step if data must be transformed).
 */
export class LectureNotesDb extends Dexie {
  sessions!: EntityTable<Session, 'id'>
  recordingDrafts!: EntityTable<RecordingDraft, 'recordingId'>

  constructor(name: string = DEFAULT_DB_NAME) {
    super(name)
    this.version(1).stores({
      sessions: 'id, updatedAt',
      recordingDrafts: 'recordingId, sessionId',
    })
  }
}
