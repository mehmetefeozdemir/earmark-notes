import { SessionSchema, type Session } from '@lecture-notes/core'
import type { LectureNotesDb } from './db'

export interface SessionSummary {
  readonly id: string
  readonly title: string
  readonly updatedAt: string
  readonly noteCount: number
}

export interface SessionList {
  readonly sessions: readonly SessionSummary[]
  /** Rows that failed validation; surfaced so the UI can offer export or deletion. */
  readonly corruptIds: readonly string[]
}

export interface SessionRepository {
  list(): Promise<SessionList>
  get(id: string): Promise<Session | undefined>
  save(session: Session): Promise<void>
  delete(id: string): Promise<void>
}

export class SessionCorruptedError extends Error {
  override readonly name = 'SessionCorruptedError'

  constructor(
    readonly sessionId: string,
    options?: ErrorOptions,
  ) {
    super(`Stored session "${sessionId}" does not match the expected schema`, options)
  }
}

const toSummary = (session: Session): SessionSummary => ({
  id: session.id,
  title: session.title,
  updatedAt: session.updatedAt,
  noteCount: session.notes.length,
})

const rowId = (row: unknown): string =>
  typeof row === 'object' && row !== null && 'id' in row ? String(row.id) : '<unknown>'

/** Session persistence on IndexedDB. Every read and write is schema-validated. */
export class DexieSessionRepository implements SessionRepository {
  constructor(private readonly db: LectureNotesDb) {}

  async list(): Promise<SessionList> {
    // Read by primary key, not the `updatedAt` index: IndexedDB leaves rows without the
    // indexed field out of the index, which would silently hide exactly the corrupt rows.
    const rows: unknown[] = await this.db.sessions.toArray()
    const sessions: SessionSummary[] = []
    const corruptIds: string[] = []
    for (const row of rows) {
      const parsed = SessionSchema.safeParse(row)
      if (parsed.success) sessions.push(toSummary(parsed.data))
      else corruptIds.push(rowId(row))
    }
    return {
      sessions: [...sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      corruptIds,
    }
  }

  async get(id: string): Promise<Session | undefined> {
    const row: unknown = await this.db.sessions.get(id)
    if (row === undefined) return undefined
    const parsed = SessionSchema.safeParse(row)
    if (!parsed.success) throw new SessionCorruptedError(id, { cause: parsed.error })
    return parsed.data
  }

  async save(session: Session): Promise<void> {
    await this.db.sessions.put(SessionSchema.parse(session))
  }

  async delete(id: string): Promise<void> {
    await this.db.sessions.delete(id)
  }
}
