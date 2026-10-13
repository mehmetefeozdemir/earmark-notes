import type { NoteKind } from '@lecture-notes/core'
import { useState, type FormEvent } from 'react'

const NOTE_KINDS: readonly NoteKind[] = ['text', 'heading', 'important', 'question', 'confused']

interface NoteComposerProps {
  readonly onSubmit: (kind: NoteKind, text: string) => void
}

export const NoteComposer = ({ onSubmit }: NoteComposerProps) => {
  const [draft, setDraft] = useState('')
  const [kind, setKind] = useState<NoteKind>('text')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    onSubmit(kind, text)
    setDraft('')
  }

  return (
    <form className="composer" onSubmit={submit}>
      <select
        aria-label="Note type"
        value={kind}
        onChange={(event) => setKind(event.target.value as NoteKind)}
      >
        {NOTE_KINDS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <input
        aria-label="Note text"
        placeholder="Type a note and press Enter"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
    </form>
  )
}
