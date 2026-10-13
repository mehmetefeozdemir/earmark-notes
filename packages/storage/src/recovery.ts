import {
  attachRecording,
  createSession,
  finalizeDraft,
  type RecordingDraft,
  type Session,
} from '@lecture-notes/core'
import type { AudioChunkStore } from './audioChunkStore'
import type { RecordingDraftRepository } from './recordingDraftRepository'
import type { SessionRepository } from './sessionRepository'

export const RECOVERED_SESSION_TITLE = 'Recovered recording'

export interface RecoveryDependencies {
  readonly sessions: SessionRepository
  readonly drafts: RecordingDraftRepository
  readonly chunks: AudioChunkStore
  readonly now: string
}

export interface RecoveredRecording {
  readonly recordingId: string
  readonly sessionId: string
}

export interface RecoveryReport {
  readonly recovered: readonly RecoveredRecording[]
  /** Drafts that captured no audio and were removed. */
  readonly discarded: readonly string[]
  /** Drafts that failed validation; left untouched so they can be inspected. */
  readonly corruptIds: readonly string[]
}

const sessionFor = async (
  sessions: SessionRepository,
  draft: RecordingDraft,
  now: string,
): Promise<Session> =>
  (await sessions.get(draft.sessionId)) ??
  createSession({ id: draft.sessionId, title: RECOVERED_SESSION_TITLE, now })

const recoverDraft = async (
  { sessions, drafts, now }: RecoveryDependencies,
  draft: RecordingDraft,
): Promise<RecoveredRecording> => {
  const session = await sessionFor(sessions, draft, now)
  // A previous run may have crashed after saving the session but before deleting the
  // draft. Re-attaching would throw, so treat "already attached" as done.
  const alreadyAttached = session.recordings.some((recording) => recording.id === draft.recordingId)
  if (!alreadyAttached) {
    await sessions.save(attachRecording(session, finalizeDraft(draft), now))
  }
  // Delete the draft only after the session is safely saved.
  await drafts.delete(draft.recordingId)
  return { recordingId: draft.recordingId, sessionId: draft.sessionId }
}

/**
 * Turns recordings interrupted by a crash or closed tab into normal recordings.
 * Safe to run repeatedly: every step is idempotent.
 */
export const recoverInterruptedRecordings = async (
  dependencies: RecoveryDependencies,
): Promise<RecoveryReport> => {
  const { drafts, chunks } = dependencies
  const { drafts: pending, corruptIds } = await drafts.list()
  const recovered: RecoveredRecording[] = []
  const discarded: string[] = []

  for (const draft of pending) {
    if (draft.chunks.length === 0) {
      await chunks.remove(draft.recordingId)
      await drafts.delete(draft.recordingId)
      discarded.push(draft.recordingId)
      continue
    }
    recovered.push(await recoverDraft(dependencies, draft))
  }

  return { recovered, discarded, corruptIds }
}
