import { useCallback, useEffect, useRef, useState } from 'react'

const TICK_MS = 250

/** Elapsed-time clock used as the session timeline until real recording lands. */
export const useStopwatch = () => {
  const startedAtRef = useRef<number | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    if (!isRunning) return undefined
    const interval = window.setInterval(() => {
      if (startedAtRef.current !== null) setElapsedMs(performance.now() - startedAtRef.current)
    }, TICK_MS)
    return () => window.clearInterval(interval)
  }, [isRunning])

  const start = useCallback(() => {
    startedAtRef.current = performance.now() - elapsedMs
    setIsRunning(true)
  }, [elapsedMs])

  const pause = useCallback(() => setIsRunning(false), [])

  const now = useCallback(
    () =>
      startedAtRef.current === null ? 0 : Math.round(performance.now() - startedAtRef.current),
    [],
  )

  return { elapsedMs, isRunning, start, pause, now }
}
