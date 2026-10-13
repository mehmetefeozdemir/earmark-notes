import { beforeEach, describe, expect, test } from 'vitest'
import type { AudioChunkStore } from './audioChunkStore'

const MIME = 'audio/webm;codecs=opus'

const blobText = (blob: Blob): Promise<string> => blob.text()

/** Behaviour every AudioChunkStore implementation must satisfy. */
export const describeAudioChunkStoreContract = (
  name: string,
  createStore: () => AudioChunkStore | Promise<AudioChunkStore>,
): void => {
  describe(`${name} (AudioChunkStore contract)`, () => {
    let store: AudioChunkStore

    beforeEach(async () => {
      store = await createStore()
    })

    test('lists no chunks for an unknown recording', async () => {
      expect(await store.list('rec-1')).toEqual([])
    })

    test('reads chunks back in index order regardless of write order', async () => {
      await store.write('rec-1', 2, new Blob(['C']))
      await store.write('rec-1', 0, new Blob(['A']))
      await store.write('rec-1', 1, new Blob(['B']))

      expect(await store.list('rec-1')).toEqual([0, 1, 2])
      const audio = await store.read('rec-1', MIME)
      expect(await blobText(audio)).toBe('ABC')
      expect(audio.type).toBe(MIME)
    })

    test('keeps recordings isolated from each other', async () => {
      await store.write('rec-1', 0, new Blob(['one']))
      await store.write('rec-2', 0, new Blob(['two']))

      expect(await blobText(await store.read('rec-2', MIME))).toBe('two')
    })

    test('overwrites a chunk written twice with the same index', async () => {
      await store.write('rec-1', 0, new Blob(['old-and-longer']))
      await store.write('rec-1', 0, new Blob(['new']))

      expect(await blobText(await store.read('rec-1', MIME))).toBe('new')
    })

    test('removes every chunk of a recording', async () => {
      await store.write('rec-1', 0, new Blob(['A']))
      await store.write('rec-1', 1, new Blob(['B']))

      await store.remove('rec-1')

      expect(await store.list('rec-1')).toEqual([])
    })

    test('removing an unknown recording is a no-op', async () => {
      await expect(store.remove('never-existed')).resolves.toBeUndefined()
    })

    test.each(['../escape', 'a/b', '', 'with space', '.'])(
      'rejects unsafe recording id %j',
      async (unsafeId) => {
        await expect(store.write(unsafeId, 0, new Blob(['x']))).rejects.toThrow(/recording id/i)
      },
    )

    test.each([-1, 1.5, Number.NaN])('rejects invalid chunk index %s', async (badIndex) => {
      await expect(store.write('rec-1', badIndex, new Blob(['x']))).rejects.toThrow(/index/i)
    })
  })
}
