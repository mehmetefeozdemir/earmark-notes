# MVP roadmap (10 weeks)

| Week | Scope                                                                                | Done when                                                        |
| ---- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| 1    | Monorepo, CI, core domain model (TDD), ADRs, provider CORS spikes                    | CI green; `docs/providers.md` compatibility table                |
| 2–3  | Dexie + OPFS storage, chunked MediaRecorder, crash recovery                          | 60-min recording survives a forced tab kill (E2E)                |
| 4    | Timeline UI: notes pinned to audio, waveform, seek, playback speed                   | Clicking a note seeks audio to its timestamp                     |
| 5    | Provider interfaces, encrypted key vault, OpenAI + Groq transcription, cost estimate | Same recording transcribed by two providers; keys never logged   |
| 6    | In-browser Whisper (Web Worker, WebGPU with WASM fallback)                           | Keyless transcription with progress, UI stays responsive         |
| 7    | Outline + quiz with Zod-validated output, retry/repair, golden test set              | All golden cases yield schema-valid output with Ollama + 1 cloud |
| 8    | "Ask your notes" with timestamp citations; Markdown/PDF export                       | Answers link back to the exact moment in the recording           |
| 9    | (Bonus) Chrome extension: tab audio capture with strict origin checks                | Records a browser tab; messages validated by origin + schema     |
| 10   | Polish: E2E suite, accessibility, Lighthouse, README, demo video, deploy             | Public demo with a keyless sample session                        |

Out of scope for the MVP: mobile apps, multi-device sync, live captions, PDF annotation, payments.
