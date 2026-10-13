# ADR 0003: IndexedDB for documents, OPFS for audio

- Status: Accepted
- Date: 2026-10-13

## Context

Sessions are small structured documents; recordings are large binary streams (about 20 MB per hour
of 48 kbps Opus). A browser tab can crash or be discarded mid-recording.

## Decision

- Session documents: IndexedDB via Dexie, validated with Zod on read and write, versioned with
  `schemaVersion` and tested migrations.
- Audio: Origin Private File System. MediaRecorder emits chunks every few seconds; each chunk is
  appended to OPFS from a worker immediately, so a crash loses at most one chunk.
- Request persistent storage (`navigator.storage.persist()`) and surface quota usage in the UI.

## Consequences

- Recovery flow needed for recordings that were never finalised.
- Safari OPFS/MediaRecorder differences must be tested early.
