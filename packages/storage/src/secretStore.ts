import type { EarmarkDb } from './db'

const ALGORITHM = 'AES-GCM'
const KEY_LENGTH_BITS = 256
const IV_BYTES = 12
const DEVICE_KEY_META = 'deviceKey'

export interface SecretStore {
  get(id: string): Promise<string | undefined>
  set(id: string, value: string): Promise<void>
  delete(id: string): Promise<void>
}

export class SecretDecryptionError extends Error {
  override readonly name = 'SecretDecryptionError'

  constructor(
    readonly secretId: string,
    options?: ErrorOptions,
  ) {
    super(`Stored secret "${secretId}" could not be decrypted; please enter it again`, options)
  }
}

const isCryptoKey = (value: unknown): value is CryptoKey =>
  typeof CryptoKey !== 'undefined' && value instanceof CryptoKey

/**
 * Returns this device's AES-GCM key, creating it on first use. The key is
 * non-extractable: IndexedDB keeps it, but no script can read its raw bytes, so a copied
 * database file is useless elsewhere. It does not protect against XSS on our own origin,
 * which could still ask the browser to decrypt — strict CSP is the defence there.
 */
export const getOrCreateDeviceKey = async (db: EarmarkDb): Promise<CryptoKey> => {
  const existing = await db.meta.get(DEVICE_KEY_META)
  if (isCryptoKey(existing?.value)) return existing.value
  const key = await crypto.subtle.generateKey({ name: ALGORITHM, length: KEY_LENGTH_BITS }, false, [
    'encrypt',
    'decrypt',
  ])
  // `add` fails if another tab created a key first; in that case use theirs.
  try {
    await db.meta.add({ key: DEVICE_KEY_META, value: key })
    return key
  } catch {
    const winner = await db.meta.get(DEVICE_KEY_META)
    if (isCryptoKey(winner?.value)) return winner.value
    throw new Error('Could not create or load the device encryption key')
  }
}

/** Secrets encrypted at rest with AES-GCM; a fresh random IV is used for every write. */
export class EncryptedSecretStore implements SecretStore {
  constructor(
    private readonly db: EarmarkDb,
    private readonly getKey: () => Promise<CryptoKey>,
  ) {}

  async get(id: string): Promise<string | undefined> {
    const row = await this.db.secrets.get(id)
    if (!row) return undefined
    try {
      const plaintext = await crypto.subtle.decrypt(
        { name: ALGORITHM, iv: row.iv },
        await this.getKey(),
        row.ciphertext,
      )
      return new TextDecoder().decode(plaintext)
    } catch (cause) {
      // GCM authentication fails on tampered data or a different key.
      throw new SecretDecryptionError(id, { cause })
    }
  }

  async set(id: string, value: string): Promise<void> {
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
    const ciphertext = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      await this.getKey(),
      new TextEncoder().encode(value),
    )
    await this.db.secrets.put({ id, iv, ciphertext })
  }

  async delete(id: string): Promise<void> {
    await this.db.secrets.delete(id)
  }
}
