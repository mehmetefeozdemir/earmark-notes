import type { ChatMessage, JsonChatClient } from '@earmark/providers'

/** Test double: replays scripted replies (or errors) and records every conversation. */
export class ScriptedClient implements JsonChatClient {
  readonly model = 'scripted-model'
  readonly calls: ChatMessage[][] = []

  constructor(private readonly replies: ReadonlyArray<unknown>) {}

  completeJson(messages: readonly ChatMessage[]): Promise<unknown> {
    this.calls.push([...messages])
    const reply = this.replies[this.calls.length - 1]
    return reply instanceof Error ? Promise.reject(reply) : Promise.resolve(reply)
  }
}
