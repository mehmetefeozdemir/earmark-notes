import {
  attachRecording,
  createSession,
  finalizeDraft,
  type Recording,
  type RecordingDraft,
  type Session,
} from '@earmark/core'
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

/**
 * Moves a draft that has audio into its session. Shared by normal "stop recording" and by
 * crash recovery, so both paths behave identically. Idempotent.
 */
export const commitDraft = async (
  { sessions, drafts, now }: RecoveryDependencies,
  draft: RecordingDraft,
): Promise<Recording> => {
  const session = await sessionFor(sessions, draft, now)
  const recording = finalizeDraft(draft)
  // A previous run may have crashed after saving the session but before deleting the
  // draft. Re-attaching would throw, so treat "already attached" as done.
  const alreadyAttached = session.recordings.some((existing) => existing.id === recording.id)
  if (!alreadyAttached) {
    await sessions.save(attachRecording(session, recording, now))
  }
  // Delete the draft only after the session is safely saved.
  await drafts.delete(draft.recordingId)
  return recording
}

/** Removes a draft that captured no audio, including any stray chunk files. */
export const discardDraft = async (
  { drafts, chunks }: Pick<RecoveryDependencies, 'drafts' | 'chunks'>,
  recordingId: string,
): Promise<void> => {
  await chunks.remove(recordingId)
  await drafts.delete(recordingId)
}

/**
 * Turns recordings interrupted by a crash or closed tab into normal recordings.
 * Safe to run repeatedly: every step is idempotent.
 */
export const recoverInterruptedRecordings = async (
  dependencies: RecoveryDependencies,
): Promise<RecoveryReport> => {
  const { drafts: pending, corruptIds } = await dependencies.drafts.list()
  const recovered: RecoveredRecording[] = []
  const discarded: string[] = []

  for (const draft of pending) {
    if (draft.chunks.length === 0) {
      await discardDraft(dependencies, draft.recordingId)
      discarded.push(draft.recordingId)
      continue
    }
    await commitDraft(dependencies, draft)
    recovered.push({ recordingId: draft.recordingId, sessionId: draft.sessionId })
  }

  return { recovered, discarded, corruptIds }
}
