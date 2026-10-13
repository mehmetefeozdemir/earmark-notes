# ADR 0001: Local-first, no required backend

- Status: Accepted
- Date: 2026-10-13

## Context

Lecture recordings and notes are personal and often sensitive. Students also record in places with
poor connectivity (lecture halls, trains). A hosted backend would add cost, an account system and a
privacy burden that an open-source project cannot carry.

## Decision

All data lives on the user's device. The app is a PWA that works fully offline. Network access is
only used when the user explicitly invokes a cloud AI provider with their own key. Sync is optional
and deferred (see roadmap).

## Consequences

- No account, no server to run for the core experience.
- Storage limits and browser eviction become our problem (see ADR 0003).
- Multi-device use needs an opt-in sync layer later.
