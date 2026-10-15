import { useState, type FormEvent } from 'react'
import { useApiKey } from '../useApiKey'

const MIN_KEY_LENGTH = 20

export const SettingsPanel = () => {
  const { state, save, remove } = useApiKey()
  const [draft, setDraft] = useState('')
  const [message, setMessage] = useState<string>()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const key = draft.trim()
    if (key.length < MIN_KEY_LENGTH) {
      setMessage('That does not look like a complete API key.')
      return
    }
    try {
      await save(key)
      setDraft('')
      setMessage('Key saved on this device, encrypted.')
    } catch {
      setMessage('Could not save the key.')
    }
  }

  return (
    <details className="settings">
      <summary>AI settings</summary>
      <p className="settings__note">
        Your OpenAI key is encrypted and stored only in this browser. Audio is sent to OpenAI only
        when you press Transcribe.
      </p>
      {state.status === 'saved' && (
        <p>
          OpenAI key: <code>{state.masked}</code>{' '}
          <button type="button" onClick={() => void remove()}>
            Remove
          </button>
        </p>
      )}
      {state.status === 'error' && <p role="alert">{state.message}</p>}
      <form className="settings__form" onSubmit={(event) => void submit(event)}>
        <label htmlFor="openai-key">
          {state.status === 'saved' ? 'Replace OpenAI key' : 'OpenAI API key'}
        </label>
        <input
          id="openai-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="sk-…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit">Save</button>
      </form>
      {message && <p role="status">{message}</p>}
    </details>
  )
}
