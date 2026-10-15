# Earmark Notes

**Local-first, open-source lecture notes with AI — bring your own key, or run fully on-device.**

Record a lecture, take notes that are pinned to the exact moment they were written, then turn the
recording into a transcript, an outline and a quiz using the AI provider _you_ choose. Your data
never leaves your device unless you send it to a provider yourself.

> Status: early development (week 1 of a 10-week MVP plan — see [`docs/roadmap.md`](docs/roadmap.md)).

## Why

- **Local-first** — works offline; sessions live in your browser (IndexedDB + OPFS).
- **Bring your own key** — OpenAI, Anthropic, Gemini, Groq, AssemblyAI, Deepgram, or any
  OpenAI-compatible endpoint. No account, no subscription.
- **Keyless mode** — on-device transcription with Whisper (WebGPU) and local LLMs via Ollama.

## Architecture

```
apps/web          React + Vite PWA (UI only)
packages/core     Platform-agnostic domain model: Zod schemas + pure, immutable operations
```

Planned: `packages/storage` (Dexie + OPFS), `packages/audio`, `packages/providers`,
`packages/ai-features`, `apps/extension` (Chrome tab-audio capture).

Key decisions are recorded as ADRs in [`docs/adr`](docs/adr).

## Getting started

Requires Node 22+.

```bash
npm install
npm run dev        # http://localhost:5180
```

## Quality gates

```bash
npm run lint
npm run typecheck
npm run test:coverage   # 80% minimum, enforced in CI
npm run build
```

## Technical challenges

This section will document the interesting problems and how they were solved, e.g.:

- Recording an hour-long lecture without losing audio if the tab crashes
- Getting schema-valid structured output from five different LLM providers
- Running Whisper in the browser without freezing the UI

## License

AGPL-3.0-only.
