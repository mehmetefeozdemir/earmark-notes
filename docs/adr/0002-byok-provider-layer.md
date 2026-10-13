# ADR 0002: Bring-your-own-key provider layer

- Status: Accepted
- Date: 2026-10-13

## Context

Transcription and LLM features need third-party models. We do not want to resell API access or hold
users' keys.

## Decision

Define small interfaces per capability (batch speech-to-text, streaming speech-to-text, LLM with
structured output, text-to-speech, vision/OCR). Each provider is an adapter behind that interface.
Keys are stored on-device, encrypted with WebCrypto (AES-GCM) using a key derived from a user
passphrase. A keyless mode uses on-device models (in-browser Whisper, Ollama).

Providers that cannot be called from a browser (CORS, streaming auth) are reached through an
optional self-hosted proxy that holds the key server-side.

## Consequences

- Adding a provider = one adapter + the shared contract test suite.
- Keys must never reach logs, analytics, sync payloads or URLs; enforced by tests.
- Provider browser support must be verified per provider (tracked in `docs/providers.md`).
