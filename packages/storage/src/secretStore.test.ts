import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { EarmarkDb } from './db'
import { EncryptedSecretStore, getOrCreateDeviceKey, SecretDecryptionError } from './secretStore'

const API_KEY = 'sk-test-0123456789abcdef'

let db: EarmarkDb
let store: EncryptedSecretStore

beforeEach(() => {
  db = new EarmarkDb(`test-${crypto.randomUUID()}`)
  store = new EncryptedSecretStore(db, () => getOrCreateDeviceKey(db))
})

afterEach(async () => {
  await db.delete()
})

const storedRowText = async (id: string): Promise<string> => {
  const row = await db.secrets.get(id)
  const bytes = row ? new Uint8Array(row.ciphertext) : new Uint8Array()
  return new TextDecoder().decode(bytes) + JSON.stringify(row)
}

describe('EncryptedSecretStore', () => {
  test('returns undefined for a secret that was never stored', async () => {
    expect(await store.get('openai')).toBeUndefined()
  })

  test('round-trips a secret', async () => {
    await store.set('openai', API_KEY)

    expect(await store.get('openai')).toBe(API_KEY)
  })

  test('never writes the plaintext to IndexedDB', async () => {
    await store.set('openai', API_KEY)

    expect(await storedRowText('openai')).not.toContain(API_KEY)
  })

  test('uses a fresh IV for every write', async () => {
    await store.set('openai', API_KEY)
    const first = await db.secrets.get('openai')
    await store.set('openai', API_KEY)
    const second = await db.secrets.get('openai')

    expect(first?.iv).not.toEqual(second?.iv)
  })

  test('deletes a secret', async () => {
    await store.set('openai', API_KEY)

    await store.delete('openai')

    expect(await store.get('openai')).toBeUndefined()
  })

  test('detects tampering instead of returning garbage', async () => {
    await store.set('openai', API_KEY)
    const row = await db.secrets.get('openai')
    if (!row) throw new Error('secret row missing')
    const tampered = new Uint8Array(row.ciphertext)
    tampered[0] = (tampered[0] ?? 0) ^ 0xff
    await db.secrets.put({ ...row, ciphertext: tampered.buffer })

    await expect(store.get('openai')).rejects.toBeInstanceOf(SecretDecryptionError)
  })

  test('cannot be read with a different device key', async () => {
    await store.set('openai', API_KEY)
    const otherKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ])
    const strangerStore = new EncryptedSecretStore(db, () => Promise.resolve(otherKey))

    await expect(strangerStore.get('openai')).rejects.toBeInstanceOf(SecretDecryptionError)
  })
})

describe('getOrCreateDeviceKey', () => {
  test('creates one non-extractable AES-GCM key and reuses it', async () => {
    const first = await getOrCreateDeviceKey(db)
    const second = await getOrCreateDeviceKey(db)

    expect(first.extractable).toBe(false)
    expect(first.algorithm.name).toBe('AES-GCM')
    await expect(crypto.subtle.exportKey('raw', first)).rejects.toThrow()

    const iv = crypto.getRandomValues(new Uint8Array(12))
    const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, first, new Uint8Array([1]))
    await expect(
      crypto.subtle.decrypt({ name: 'AES-GCM', iv }, second, sealed),
    ).resolves.toBeDefined()
  })

  test('two tabs creating the key at the same time end up sharing one key', async () => {
    const [tabA, tabB] = await Promise.all([getOrCreateDeviceKey(db), getOrCreateDeviceKey(db)])

    const iv = crypto.getRandomValues(new Uint8Array(12))
    const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, tabA, new Uint8Array([7]))
    await expect(
      crypto.subtle.decrypt({ name: 'AES-GCM', iv }, tabB, sealed),
    ).resolves.toBeDefined()
    expect(await db.meta.count()).toBe(1)
  })
})
