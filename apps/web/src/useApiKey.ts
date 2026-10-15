import { useCallback, useEffect, useState } from 'react'
import { services } from './services'
import { maskApiKey } from './transcriptionText'

export const OPENAI_SECRET_ID = 'openai'

type KeyState =
  | { readonly status: 'loading' }
  | { readonly status: 'missing' }
  | { readonly status: 'saved'; readonly masked: string }
  | { readonly status: 'error'; readonly message: string }

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Could not access the key store'

/** The stored OpenAI key, exposed to the UI only in masked form. */
export const useApiKey = () => {
  const [state, setState] = useState<KeyState>({ status: 'loading' })

  const refresh = useCallback(async () => {
    try {
      const key = await services.secrets.get(OPENAI_SECRET_ID)
      setState(key ? { status: 'saved', masked: maskApiKey(key) } : { status: 'missing' })
    } catch (error) {
      setState({ status: 'error', message: errorMessage(error) })
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const save = useCallback(
    async (key: string) => {
      await services.secrets.set(OPENAI_SECRET_ID, key.trim())
      await refresh()
    },
    [refresh],
  )

  const remove = useCallback(async () => {
    await services.secrets.delete(OPENAI_SECRET_ID)
    await refresh()
  }, [refresh])

  return { state, save, remove }
}
