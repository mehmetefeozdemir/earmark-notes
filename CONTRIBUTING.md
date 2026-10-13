# Contributing

1. Open an issue before large changes.
2. Write tests first; keep coverage at or above 80%.
3. Keep domain logic in `packages/core` pure and immutable (return new objects, never mutate).
4. Run `npm run lint && npm run typecheck && npm test` before opening a PR.
5. Commits follow Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`).

Sign off your commits (`git commit -s`) to certify the
[Developer Certificate of Origin](https://developercertificate.org/).
