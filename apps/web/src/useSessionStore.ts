import { createSession, type Session } from '@earmark/core'
import { recoverInterruptedRecordings, type RecoveryReport } from '@earmark/storage'
import { useCallback, useEffect, useRef, useState } from 'react'
import { requestPersistentStorage, services } from './services'

const nowIso = () => new Date().toISOString()
const DEFAULT_TITLE = 'My first lecture'

type StoreState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly session: Session }
  | { readonly status: 'error'; readonly message: string }

interface InitialLoad {
  readonly session: Session
  readonly recovery: RecoveryReport
}

const loadInitialState = async (): Promise<InitialLoad> => {
  await requestPersistentStorage()
  const recovery = await recoverInterruptedRecordings({ ...services, now: nowIso() })
  const { sessions } = await services.sessions.list()
  const latestId = sessions[0]?.id
  const existing = latestId ? await services.sessions.get(latestId) : undefined
  if (existing) return { session: existing, recovery }
  const fresh = createSession({ id: crypto.randomUUID(), title: DEFAULT_TITLE, now: nowIso() })
  await services.sessions.save(fresh)
  return { session: fresh, recovery }
}

// Module-level so React StrictMode's double effect run cannot start recovery twice.
let initialLoad: Promise<InitialLoad> | undefined

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unexpected storage error'

/**
 * Owns the current session. Every read-modify-write goes through one queue, so a note
 * typed while a recording is being committed can never overwrite that recording.
 */
export const useSessionStore = () => {
  const [state, setState] = useState<StoreState>({ status: 'loading' })
  const [recovery, setRecovery] = useState<RecoveryReport>()
  const [saveError, setSaveError] = useState<string>()
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const sessionId = state.status === 'ready' ? state.session.id : undefined

  useEffect(() => {
    initialLoad ??= loadInitialState()
    initialLoad.then(
      ({ session, recovery: report }) => {
        setState({ status: 'ready', session })
        setRecovery(report)
      },
      (error: unknown) => setState({ status: 'error', message: errorMessage(error) }),
    )
  }, [])

  const exclusive = useCallback(<T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.current.then(task, task)
    queue.current = run.catch(() => undefined)
    return run
  }, [])

  const reload = useCallback(async (id: string) => {
    const latest = await services.sessions.get(id)
    if (latest) setState({ status: 'ready', session: latest })
  }, [])

  const mutate = useCallback(
    (change: (session: Session) => Session) => {
      if (!sessionId) return Promise.resolve()
      return exclusive(async () => {
        try {
          const current = await services.sessions.get(sessionId)
          if (!current) throw new Error('The current session no longer exists')
          const next = change(current)
          await services.sessions.save(next)
          setState({ status: 'ready', session: next })
          setSaveError(undefined)
        } catch (error) {
          setSaveError(errorMessage(error))
        }
      })
    },
    [exclusive, sessionId],
  )

  /** Runs a task that writes the session itself (e.g. committing a recording), then reloads. */
  const runAndReload = useCallback(
    <T>(task: () => Promise<T>): Promise<T> =>
      exclusive(async () => {
        try {
          return await task()
        } finally {
          if (sessionId) await reload(sessionId)
        }
      }),
    [exclusive, reload, sessionId],
  )

  return {
    state,
    recovery,
    saveError,
    mutate,
    runAndReload,
    dismissRecovery: () => setRecovery(undefined),
  }
}
