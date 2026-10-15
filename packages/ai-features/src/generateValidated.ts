import { ProviderError, type ChatMessage, type JsonChatClient } from '@earmark/providers'
import { z } from 'zod'

const DEFAULT_MAX_REPAIRS = 2

/** The model kept producing output that failed validation, even after repair prompts. */
export class GenerationError extends Error {
  override readonly name = 'GenerationError'
}

export interface GenerateValidatedOptions<T> {
  readonly client: JsonChatClient
  readonly messages: readonly ChatMessage[]
  readonly schema: z.ZodType<T>
  /** Extra domain checks (e.g. grounding); throw with a message the model can act on. */
  readonly refine?: (value: T) => T
  readonly maxRepairs?: number
  readonly signal?: AbortSignal
}

interface Attempt<T> {
  readonly value?: T
  /** What the model said, echoed back verbatim in the repair turn. */
  readonly rawOutput?: string
  readonly problem?: string
}

const describeIssues = (error: z.ZodError): string =>
  error.issues
    .slice(0, 10)
    .map((issue) => `- ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n')

const attempt = async <T>(
  options: GenerateValidatedOptions<T>,
  messages: readonly ChatMessage[],
): Promise<Attempt<T>> => {
  let output: unknown
  try {
    output = await options.client.completeJson(messages, options.signal)
  } catch (error) {
    // Only malformed JSON is the model's fault and worth a repair; anything else
    // (bad key, quota, network) would fail again, so it is rethrown.
    if (error instanceof ProviderError && error.kind === 'invalid-json') {
      return { rawOutput: error.rawOutput ?? '', problem: 'The reply was not valid JSON.' }
    }
    throw error
  }
  const rawOutput = JSON.stringify(output)
  const parsed = options.schema.safeParse(output)
  if (!parsed.success) return { rawOutput, problem: describeIssues(parsed.error) }
  try {
    return { value: options.refine ? options.refine(parsed.data) : parsed.data }
  } catch (error) {
    return { rawOutput, problem: error instanceof Error ? error.message : String(error) }
  }
}

const repairTurn = (rawOutput: string, problem: string): ChatMessage[] => [
  { role: 'assistant', content: rawOutput },
  {
    role: 'user',
    content: `Your previous answer was invalid:\n${problem}\nReply again with only the corrected JSON object.`,
  },
]

/**
 * Asks a model for JSON and only returns output that passes the schema (and optional
 * domain checks). Invalid output is shown back to the model with the exact problems,
 * up to `maxRepairs` times, before giving up.
 */
export const generateValidated = async <T>(options: GenerateValidatedOptions<T>): Promise<T> => {
  const maxRepairs = options.maxRepairs ?? DEFAULT_MAX_REPAIRS
  let conversation: readonly ChatMessage[] = options.messages
  let lastProblem = ''
  for (let round = 0; round <= maxRepairs; round += 1) {
    const result = await attempt(options, conversation)
    if (result.value !== undefined) return result.value
    lastProblem = result.problem ?? 'unknown problem'
    conversation = [...options.messages, ...repairTurn(result.rawOutput ?? '', lastProblem)]
  }
  throw new GenerationError(
    `The model did not produce valid output after ${maxRepairs + 1} attempts: ${lastProblem}`,
  )
}
