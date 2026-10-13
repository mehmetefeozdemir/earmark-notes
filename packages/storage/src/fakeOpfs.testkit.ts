/**
 * Minimal in-memory stand-in for the OPFS directory/file handle API, covering only the
 * subset OpfsAudioChunkStore uses. Node has no OPFS, so tests run the real store on this.
 */

const notFound = (name: string): DOMException =>
  new DOMException(`Entry "${name}" not found`, 'NotFoundError')

export class FakeFileHandle {
  readonly kind = 'file'
  private content = new Blob([])

  constructor(readonly name: string) {}

  getFile(): Promise<File> {
    return Promise.resolve(new File([this.content], this.name))
  }

  createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }> {
    const parts: Blob[] = []
    return Promise.resolve({
      write: (data: Blob) => {
        parts.push(data)
        return Promise.resolve()
      },
      close: () => {
        this.content = new Blob(parts)
        return Promise.resolve()
      },
    })
  }
}

export class FakeDirectoryHandle {
  readonly kind = 'directory'
  private readonly entries = new Map<string, FakeDirectoryHandle | FakeFileHandle>()

  constructor(readonly name: string = '') {}

  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FakeDirectoryHandle> {
    const existing = this.entries.get(name)
    if (existing instanceof FakeDirectoryHandle) return Promise.resolve(existing)
    if (!options?.create) return Promise.reject(notFound(name))
    const created = new FakeDirectoryHandle(name)
    this.entries.set(name, created)
    return Promise.resolve(created)
  }

  getFileHandle(name: string, options?: { create?: boolean }): Promise<FakeFileHandle> {
    const existing = this.entries.get(name)
    if (existing instanceof FakeFileHandle) return Promise.resolve(existing)
    if (!options?.create) return Promise.reject(notFound(name))
    const created = new FakeFileHandle(name)
    this.entries.set(name, created)
    return Promise.resolve(created)
  }

  removeEntry(name: string): Promise<void> {
    if (!this.entries.delete(name)) return Promise.reject(notFound(name))
    return Promise.resolve()
  }

  async *keys(): AsyncIterableIterator<string> {
    for (const key of this.entries.keys()) yield key
  }
}
