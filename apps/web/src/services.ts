import {
  DexieRecordingDraftRepository,
  DexieSessionRepository,
  LectureNotesDb,
  MemoryAudioChunkStore,
  OpfsAudioChunkStore,
  type AudioChunkStore,
} from '@lecture-notes/storage'

const supportsOpfs = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function'

const db = new LectureNotesDb()

/** Single wiring point for persistence; components never construct storage themselves. */
export const services = {
  sessions: new DexieSessionRepository(db),
  drafts: new DexieRecordingDraftRepository(db),
  chunks: (supportsOpfs()
    ? new OpfsAudioChunkStore()
    : new MemoryAudioChunkStore()) as AudioChunkStore,
  /** False when audio only lives in memory (no OPFS) and will be lost on reload. */
  audioIsPersistent: supportsOpfs(),
}

/** Asks the browser not to evict our data under storage pressure. Best effort. */
export const requestPersistentStorage = async (): Promise<boolean> => {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}
