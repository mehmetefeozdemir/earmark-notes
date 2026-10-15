import type { RecordingDraft, Session } from '@earmark/core'
import { Dexie, type EntityTable } from 'dexie'

export const DEFAULT_DB_NAME = 'earmark-notes'

/** An encrypted secret (e.g. an API key). The plaintext is never stored. */
export interface SecretRow {
  readonly id: string
  readonly iv: Uint8Array<ArrayBuffer>
  readonly ciphertext: ArrayBuffer
}

/** Small key/value records; values may be structured-cloneable objects such as CryptoKey. */
export interface MetaRow {
  readonly key: string
  readonly value: unknown
}

/**
 * IndexedDB schema. Once a version has shipped, never edit it in place:
 * add a new version (with an upgrade step if data must be transformed).
 */
export class EarmarkDb extends Dexie {
  sessions!: EntityTable<Session, 'id'>
  recordingDrafts!: EntityTable<RecordingDraft, 'recordingId'>
  secrets!: EntityTable<SecretRow, 'id'>
  meta!: EntityTable<MetaRow, 'key'>

  constructor(name: string = DEFAULT_DB_NAME) {
    super(name)
    this.version(1).stores({
      sessions: 'id, updatedAt',
      recordingDrafts: 'recordingId, sessionId',
    })
    // v2: encrypted provider API keys and the device key that protects them.
    this.version(2).stores({
      secrets: 'id',
      meta: 'key',
    })
  }
}
