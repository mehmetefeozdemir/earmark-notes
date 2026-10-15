import { generateOutline, generateQuiz } from '@earmark/ai-features'
import { attachStudyAids, type Recording, type Session } from '@earmark/core'
import { OpenAiChatClient } from '@earmark/providers'
import { useCallback, useState } from 'react'
import { services } from './services'
import { studyAidErrorMessage } from './transcriptionText'
import { OPENAI_SECRET_ID } from './useApiKey'

export type StudyAidKind = 'outline' | 'quiz'

export interface StudyAidStatus {
  readonly busy: boolean
  readonly error?: string
  readonly notice?: string
}

const statusKey = (recordingId: string, kind: StudyAidKind) => `${recordingId}:${kind}`

interface UseStudyAidsOptions {
  readonly mutate: (change: (session: Session) => Session) => Promise<void>
}

export const useStudyAids = ({ mutate }: UseStudyAidsOptions) => {
  const [statuses, setStatuses] = useState<Readonly<Record<string, StudyAidStatus>>>({})

  const setStatus = (recordingId: string, kind: StudyAidKind, status: StudyAidStatus) =>
    setStatuses((current) => ({ ...current, [statusKey(recordingId, kind)]: status }))

  const generate = useCallback(
    async (recording: Recording, kind: StudyAidKind) => {
      const { transcript } = recording
      if (!transcript) return
      setStatus(recording.id, kind, { busy: true })
      try {
        const apiKey = await services.secrets.get(OPENAI_SECRET_ID)
        if (!apiKey) {
          setStatus(recording.id, kind, {
            busy: false,
            error: 'Add your OpenAI API key in AI settings first.',
          })
          return
        }
        const client = new OpenAiChatClient({ apiKey })
        const now = new Date().toISOString()
        if (kind === 'outline') {
          const outline = await generateOutline({ client, transcript })
          await mutate((session) => attachStudyAids(session, recording.id, { outline }, now))
          setStatus(recording.id, kind, { busy: false })
          return
        }
        const { quiz, droppedCount } = await generateQuiz({ client, transcript })
        await mutate((session) => attachStudyAids(session, recording.id, { quiz }, now))
        setStatus(recording.id, kind, {
          busy: false,
          ...(droppedCount > 0
            ? {
                notice: `${droppedCount} question(s) were discarded because they could not be traced to the transcript.`,
              }
            : {}),
        })
      } catch (error) {
        setStatus(recording.id, kind, { busy: false, error: studyAidErrorMessage(error) })
      }
    },
    [mutate],
  )

  const statusFor = (recordingId: string, kind: StudyAidKind): StudyAidStatus | undefined =>
    statuses[statusKey(recordingId, kind)]

  return { generate, statusFor }
}
