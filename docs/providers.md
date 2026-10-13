# Provider compatibility

Can each provider be called directly from the browser (no proxy)?

Checked on 2026-10-13 with `node scripts/check-cors.mjs` from origin `http://localhost:5180`. The
script sends the same CORS preflight a browser sends (method + auth headers) and checks that the
provider allows our origin and headers. No API keys are used.

| Provider   | Endpoint / capability                   | Preflight | Allowed origin | Browser-direct |
| ---------- | --------------------------------------- | --------- | -------------- | -------------- |
| OpenAI     | `/v1/audio/transcriptions` (STT batch)  | 200       | echoes origin  | Yes            |
| OpenAI     | `/v1/chat/completions` (LLM)            | 200       | echoes origin  | Yes            |
| Anthropic  | `/v1/messages` (LLM)                    | 200       | `*`            | Yes ¹          |
| Gemini     | `:generateContent` (LLM)                | 200       | echoes origin  | Yes            |
| Groq       | `/openai/v1/audio/transcriptions` (STT) | 204       | `*`            | Yes            |
| Groq       | `/openai/v1/chat/completions` (LLM)     | 204       | `*`            | Yes            |
| OpenRouter | `/api/v1/chat/completions` (LLM)        | 204       | `*`            | Yes            |
| AssemblyAI | `/v2/upload` + `/v2/transcript` (STT)   | 200       | `*`            | Yes            |
| AssemblyAI | `/v3/token` (streaming token)           | 405       | none           | **No → proxy** |
| Deepgram   | `/v1/listen` (STT batch)                | 200       | echoes origin  | Yes            |
| Deepgram   | WebSocket `/v1/listen` (streaming)      | n/a ²     | n/a            | To verify ³    |
| Ollama     | local `/api/chat` (LLM)                 | —         | —              | To verify ⁴    |

1. Requires the `anthropic-dangerous-direct-browser-access: true` request header.
2. WebSockets are not subject to CORS preflights.
3. Browsers cannot set an `Authorization` header on WebSockets; verify subprotocol-based auth with a
   real key before relying on it.
4. Depends on the user's `OLLAMA_ORIGINS` setting; document how to allow the app's origin.

## Consequences

- The MVP (batch transcription + LLM features) needs **no proxy**: every chosen provider allows
  browser-direct calls.
- AssemblyAI live captions require the optional proxy to mint short-lived streaming tokens.
- A passing preflight is necessary but not sufficient: the real response must also carry CORS
  headers. Each adapter's first integration test with a real key confirms this.
