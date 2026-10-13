/**
 * Storage for recorded audio, one file per MediaRecorder chunk.
 *
 * One file per chunk (instead of appending to a single file) means every completed write
 * is a whole, closed file: a crash mid-recording can lose at most the chunk in flight and
 * can never leave a half-appended file behind.
 */
export interface AudioChunkStore {
  write(recordingId: string, index: number, data: Blob): Promise<void>
  /** Chunk indices present for the recording, ascending. */
  list(recordingId: string): Promise<number[]>
  /** All chunks concatenated in index order. */
  read(recordingId: string, mimeType: string): Promise<Blob>
  remove(recordingId: string): Promise<void>
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/
const RECORDINGS_DIR = 'recordings'
const CHUNK_SUFFIX = '.chunk'
const INDEX_DIGITS = 6

/** Ids become directory names, so only allow characters that cannot escape the folder. */
const assertSafeRecordingId = (recordingId: string): void => {
  if (!SAFE_ID.test(recordingId)) {
    throw new Error(`Invalid recording id "${recordingId}": use 1-128 of [A-Za-z0-9_-]`)
  }
}

const assertValidIndex = (index: number): void => {
  if (!Number.isSafeInteger(index) || index < 0) {
    throw new Error(`Invalid chunk index ${index}: must be a non-negative integer`)
  }
}

const ascending = (a: number, b: number): number => a - b

export class MemoryAudioChunkStore implements AudioChunkStore {
  private readonly recordings = new Map<string, ReadonlyMap<number, Blob>>()

  // Methods are async so validation failures reject (like the OPFS store) instead of
  // throwing synchronously past callers that only handle promise rejections.
  async write(recordingId: string, index: number, data: Blob): Promise<void> {
    assertSafeRecordingId(recordingId)
    assertValidIndex(index)
    const chunks = new Map(this.recordings.get(recordingId))
    chunks.set(index, data)
    this.recordings.set(recordingId, chunks)
  }

  async list(recordingId: string): Promise<number[]> {
    assertSafeRecordingId(recordingId)
    return [...(this.recordings.get(recordingId)?.keys() ?? [])].sort(ascending)
  }

  async read(recordingId: string, mimeType: string): Promise<Blob> {
    const indices = await this.list(recordingId)
    const chunks = this.recordings.get(recordingId)
    return new Blob(
      indices.flatMap((index) => chunks?.get(index) ?? []),
      { type: mimeType },
    )
  }

  async remove(recordingId: string): Promise<void> {
    assertSafeRecordingId(recordingId)
    this.recordings.delete(recordingId)
  }
}

const chunkFileName = (index: number): string =>
  `${index.toString().padStart(INDEX_DIGITS, '0')}${CHUNK_SUFFIX}`

const parseChunkFileName = (name: string): number | undefined => {
  if (!name.endsWith(CHUNK_SUFFIX)) return undefined
  const index = Number(name.slice(0, -CHUNK_SUFFIX.length))
  return Number.isSafeInteger(index) && index >= 0 ? index : undefined
}

const isNotFound = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'NotFoundError'

/** Origin Private File System implementation: recordings/<recordingId>/<index>.chunk */
export class OpfsAudioChunkStore implements AudioChunkStore {
  constructor(
    private readonly getRoot: () => Promise<FileSystemDirectoryHandle> = () =>
      navigator.storage.getDirectory(),
  ) {}

  private async recordingsDir(): Promise<FileSystemDirectoryHandle> {
    const root = await this.getRoot()
    return root.getDirectoryHandle(RECORDINGS_DIR, { create: true })
  }

  private async recordingDir(
    recordingId: string,
    create: boolean,
  ): Promise<FileSystemDirectoryHandle | undefined> {
    assertSafeRecordingId(recordingId)
    const parent = await this.recordingsDir()
    try {
      return await parent.getDirectoryHandle(recordingId, { create })
    } catch (error) {
      if (isNotFound(error)) return undefined
      throw error
    }
  }

  async write(recordingId: string, index: number, data: Blob): Promise<void> {
    assertValidIndex(index)
    const dir = await this.recordingDir(recordingId, true)
    if (!dir) throw new Error(`Could not create storage for recording "${recordingId}"`)
    const file = await dir.getFileHandle(chunkFileName(index), { create: true })
    const writable = await file.createWritable()
    await writable.write(data)
    await writable.close()
  }

  async list(recordingId: string): Promise<number[]> {
    const dir = await this.recordingDir(recordingId, false)
    if (!dir) return []
    const indices: number[] = []
    for await (const name of dir.keys()) {
      const index = parseChunkFileName(name)
      if (index !== undefined) indices.push(index)
    }
    return indices.sort(ascending)
  }

  async read(recordingId: string, mimeType: string): Promise<Blob> {
    const dir = await this.recordingDir(recordingId, false)
    if (!dir) return new Blob([], { type: mimeType })
    const indices = await this.list(recordingId)
    const files = await Promise.all(
      indices.map(async (index) => (await dir.getFileHandle(chunkFileName(index))).getFile()),
    )
    return new Blob(files, { type: mimeType })
  }

  async remove(recordingId: string): Promise<void> {
    assertSafeRecordingId(recordingId)
    const parent = await this.recordingsDir()
    try {
      await parent.removeEntry(recordingId, { recursive: true })
    } catch (error) {
      if (!isNotFound(error)) throw error
    }
  }
}
