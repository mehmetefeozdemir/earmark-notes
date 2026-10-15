import { attachTranscript, type Recording, type Session } from '@earmark/core'
import { OpenAiTranscriber } from '@earmark/providers'
import { useCallback, useState } from 'react'
import { services } from './services'
import { transcriptionErrorMessage } from './transcriptionText'
import { OPENAI_SECRET_ID } from './useApiKey'

export interface TranscriptionStatus {
  readonly busy: boolean
  readonly error?: string
}

interface UseTranscriptionOptions {
  readonly mutate: (change: (session: Session) => Session) => Promise<void>
}

export const useTranscription = ({ mutate }: UseTranscriptionOptions) => {
  const [statuses, setStatuses] = useState<Readonly<Record<string, TranscriptionStatus>>>({})

  const setStatus = (recordingId: string, status: TranscriptionStatus) =>
    setStatuses((current) => ({ ...current, [recordingId]: status }))

  const transcribe = useCallback(
    async (recording: Recording) => {
      setStatus(recording.id, { busy: true })
      try {
        const apiKey = await services.secrets.get(OPENAI_SECRET_ID)
        if (!apiKey) {
          setStatus(recording.id, {
            busy: false,
            error: 'Add your OpenAI API key in AI settings first.',
          })
          return
        }
        const audio = await services.chunks.read(recording.id, recording.mimeType)
        const transcript = await new OpenAiTranscriber({ apiKey }).transcribe(audio)
        await mutate((session) =>
          attachTranscript(session, recording.id, transcript, new Date().toISOString()),
        )
        setStatus(recording.id, { busy: false })
      } catch (error) {
        setStatus(recording.id, { busy: false, error: transcriptionErrorMessage(error) })
      }
    },
    [mutate],
  )

  return { statuses, transcribe }
}
