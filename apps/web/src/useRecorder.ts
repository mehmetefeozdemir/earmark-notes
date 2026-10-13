import { ChunkedRecorder, pickSupportedMimeType } from '@lecture-notes/audio'
import type { Recording } from '@lecture-notes/core'
import { RecordingWriter } from '@lecture-notes/storage'
import { useCallback, useRef, useState } from 'react'
import { services } from './services'

const CHUNK_MS = 5_000
const AUDIO_BITS_PER_SECOND = 48_000
const FALLBACK_MIME = 'audio/webm'

export type RecorderStatus = 'idle' | 'starting' | 'recording' | 'paused' | 'stopping'

interface ActiveRecording {
  readonly recorder: ChunkedRecorder
  readonly writer: RecordingWriter
  readonly stream: MediaStream
}

const microphoneErrorMessage = (error: unknown): string => {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'Microphone access was denied. Allow it in your browser settings to record.'
  }
  if (error instanceof DOMException && error.name === 'NotFoundError') {
    return 'No microphone was found.'
  }
  return 'Could not start the microphone.'
}

const stopTracks = (stream: MediaStream) => stream.getTracks().forEach((track) => track.stop())

interface UseRecorderOptions {
  /** Serialises the final commit with other session writes (see useSessionStore). */
  readonly runAndReload: <T>(task: () => Promise<T>) => Promise<T>
}

export const useRecorder = ({ runAndReload }: UseRecorderOptions) => {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [error, setError] = useState<string>()
  const active = useRef<ActiveRecording | undefined>(undefined)

  /** Resolves to true only once audio is actually being captured. */
  const start = useCallback(async (sessionId: string): Promise<boolean> => {
    if (active.current) return false
    setError(undefined)
    setStatus('starting')
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (cause) {
      setError(microphoneErrorMessage(cause))
      setStatus('idle')
      return false
    }
    try {
      const mimeType = pickSupportedMimeType((type) => MediaRecorder.isTypeSupported(type))
      const mediaRecorder = new MediaRecorder(stream, {
        audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
        ...(mimeType ? { mimeType } : {}),
      })
      const writer = await RecordingWriter.begin(
        {
          recordingId: crypto.randomUUID(),
          sessionId,
          startedAt: new Date().toISOString(),
          mimeType: mediaRecorder.mimeType || mimeType || FALLBACK_MIME,
          source: 'mic',
        },
        services,
      )
      const recorder = new ChunkedRecorder({
        mediaRecorder,
        timesliceMs: CHUNK_MS,
        onChunk: (chunk) => writer.writeChunk(chunk),
      })
      recorder.start()
      active.current = { recorder, writer, stream }
      setStatus('recording')
      return true
    } catch (cause) {
      stopTracks(stream)
      setError(cause instanceof Error ? cause.message : 'Could not start recording.')
      setStatus('idle')
      return false
    }
  }, [])

  const pause = useCallback(() => {
    active.current?.recorder.pause()
    setStatus('paused')
  }, [])

  const resume = useCallback(() => {
    active.current?.recorder.resume()
    setStatus('recording')
  }, [])

  const stop = useCallback(async (): Promise<Recording | undefined> => {
    const current = active.current
    if (!current) return undefined
    setStatus('stopping')
    try {
      await current.recorder.stop()
    } catch (cause) {
      // Chunks written before the failure are intact and contiguous: keep them.
      setError(
        `Recording stopped early: ${cause instanceof Error ? cause.message : 'unknown error'}`,
      )
    } finally {
      stopTracks(current.stream)
      active.current = undefined
    }
    try {
      return await runAndReload(() => current.writer.finish(new Date().toISOString()))
    } catch (cause) {
      setError(
        `Could not save the recording (it will be recovered on next launch): ${
          cause instanceof Error ? cause.message : 'unknown error'
        }`,
      )
      return undefined
    } finally {
      setStatus('idle')
    }
  }, [runAndReload])

  return { status, error, start, pause, resume, stop }
}
