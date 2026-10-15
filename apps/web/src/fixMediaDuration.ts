/** Far beyond any real recording; seeking here makes the browser scan to the true end. */
const SEEK_TO_END = Number.MAX_SAFE_INTEGER

/**
 * WebM files produced by MediaRecorder carry no duration header, so Chrome reports
 * `duration = Infinity` and the native player shows 0:00 until playback ends.
 * Seeking past the end forces the browser to compute the real duration; we then
 * rewind to the start. Returns a cleanup function that removes the listeners.
 */
export const fixMediaDuration = (media: HTMLMediaElement): (() => void) => {
  let fixing = false

  const handleMetadata = () => {
    if (Number.isFinite(media.duration)) return
    fixing = true
    media.currentTime = SEEK_TO_END
  }

  const handleDurationChange = () => {
    if (!fixing || !Number.isFinite(media.duration)) return
    fixing = false
    media.currentTime = 0
  }

  media.addEventListener('loadedmetadata', handleMetadata)
  media.addEventListener('durationchange', handleDurationChange)
  return () => {
    media.removeEventListener('loadedmetadata', handleMetadata)
    media.removeEventListener('durationchange', handleDurationChange)
  }
}
