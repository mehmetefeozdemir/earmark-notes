const MS_PER_SECOND = 1_000
const SECONDS_PER_MINUTE = 60
const SECONDS_PER_HOUR = 3_600

const pad = (value: number): string => value.toString().padStart(2, '0')

/** Formats a timeline offset as m:ss, or h:mm:ss from one hour on. */
export const formatTimestamp = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / MS_PER_SECOND))
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR)
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE)
  const seconds = totalSeconds % SECONDS_PER_MINUTE
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}
