import type { Note } from '@earmark/core'
import { formatTimestamp } from '../formatTimestamp'

interface NoteListProps {
  readonly notes: readonly Note[]
}

export const NoteList = ({ notes }: NoteListProps) => {
  if (notes.length === 0) {
    return <p className="empty">No notes yet. Start recording and type as you listen.</p>
  }
  return (
    <ol className="notes">
      {notes.map((note) => (
        <li key={note.id} className={`note note--${note.kind}`}>
          <time>{formatTimestamp(note.atMs)}</time>
          <span>{note.text}</span>
        </li>
      ))}
    </ol>
  )
}
