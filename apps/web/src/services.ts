import {
  DexieRecordingDraftRepository,
  DexieSessionRepository,
  EarmarkDb,
  EncryptedSecretStore,
  getOrCreateDeviceKey,
  MemoryAudioChunkStore,
  OpfsAudioChunkStore,
  type AudioChunkStore,
} from '@earmark/storage'

const supportsOpfs = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function'

const db = new EarmarkDb()

let deviceKey: Promise<CryptoKey> | undefined
const loadDeviceKey = (): Promise<CryptoKey> => (deviceKey ??= getOrCreateDeviceKey(db))

/** Single wiring point for persistence; components never construct storage themselves. */
export const services = {
  sessions: new DexieSessionRepository(db),
  drafts: new DexieRecordingDraftRepository(db),
  /** Provider API keys, encrypted at rest with a non-extractable device key. */
  secrets: new EncryptedSecretStore(db, loadDeviceKey),
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
