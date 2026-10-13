import { useCallback, useEffect, useRef, useState } from 'react'

const TICK_MS = 250

/**
 * Active-time clock for the current recording. Paused time is excluded, so `now()`
 * always matches the position in the recorded audio.
 */
export const useStopwatch = () => {
  const accumulatedRef = useRef(0)
  const segmentStartRef = useRef<number | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [isRunning, setIsRunning] = useState(false)

  const now = useCallback(() => {
    const running =
      segmentStartRef.current === null ? 0 : performance.now() - segmentStartRef.current
    return Math.round(accumulatedRef.current + running)
  }, [])

  useEffect(() => {
    if (!isRunning) return undefined
    const interval = window.setInterval(() => setElapsedMs(now()), TICK_MS)
    return () => window.clearInterval(interval)
  }, [isRunning, now])

  const start = useCallback(() => {
    if (segmentStartRef.current !== null) return
    segmentStartRef.current = performance.now()
    setIsRunning(true)
  }, [])

  const pause = useCallback(() => {
    accumulatedRef.current = now()
    segmentStartRef.current = null
    setElapsedMs(accumulatedRef.current)
    setIsRunning(false)
  }, [now])

  const reset = useCallback(() => {
    accumulatedRef.current = 0
    segmentStartRef.current = null
    setElapsedMs(0)
    setIsRunning(false)
  }, [])

  return { elapsedMs, isRunning, start, pause, reset, now }
}
