import { useState, type FormEvent } from 'react'

interface SessionTitleProps {
  readonly title: string
  readonly onRename: (title: string) => void
}

/** The lecture title; click to rename, Enter or leaving the field saves, Escape cancels. */
export const SessionTitle = ({ title, onRename }: SessionTitleProps) => {
  const [draft, setDraft] = useState<string>()

  if (draft === undefined) {
    return (
      <h1>
        <button
          type="button"
          className="session-title"
          onClick={() => setDraft(title)}
          aria-label={`Rename lecture "${title}"`}
        >
          {title}
        </button>
      </h1>
    )
  }

  const commit = (event?: FormEvent) => {
    event?.preventDefault()
    const next = draft.trim()
    if (next && next !== title) onRename(next)
    setDraft(undefined)
  }

  return (
    <form onSubmit={commit} className="session-title__form">
      <input
        aria-label="Lecture title"
        value={draft}
        autoFocus
        // Select the old title so typing replaces it instead of appending to it.
        onFocus={(event) => event.target.select()}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => commit()}
        onKeyDown={(event) => event.key === 'Escape' && setDraft(undefined)}
      />
    </form>
  )
}
