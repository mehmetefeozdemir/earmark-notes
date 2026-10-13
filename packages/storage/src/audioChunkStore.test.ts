import { MemoryAudioChunkStore, OpfsAudioChunkStore } from './audioChunkStore'
import { describeAudioChunkStoreContract } from './audioChunkStore.contract'
import { FakeDirectoryHandle } from './fakeOpfs.testkit'

describeAudioChunkStoreContract('MemoryAudioChunkStore', () => new MemoryAudioChunkStore())

describeAudioChunkStoreContract('OpfsAudioChunkStore', () => {
  // Like the real OPFS root, the same directory must be returned on every call.
  const root = new FakeDirectoryHandle() as unknown as FileSystemDirectoryHandle
  return new OpfsAudioChunkStore(() => Promise.resolve(root))
})
