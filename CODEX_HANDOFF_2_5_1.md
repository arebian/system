# Codex Handoff — THE SYSTEM 2.5.1

Read `AGENTS.md` first.

## Current master

`2.5.1 — FOUNDATION HARDENING`

## What was intentionally changed

- extracted the large global CSS template from `App.jsx` to `styles/system.css`
- moved the runtime error boundary around the whole authenticated/boot runtime rather than only `SystemGame`
- hardened local cache reset in the error screen
- added `systemExternalCore.js` for pure/testable request contract helpers
- added client-side timeout + short-lived content caches in `systemExternal.js`
- added upstream timeout handling, short-lived content cache and best-effort per-user rate limiting to Edge Functions
- added Node built-in tests
- added architecture, Edge Function and async-safety docs

## Do not do next

Do not perform a one-shot rewrite of the remaining `App.jsx`.

## Recommended next refactor sequence

1. verify 2.5.1 manually in browser
2. expand tests around the feature being moved
3. extract `SystemIntelligence` into its own component/hook
4. extract `GrandArchive`
5. extract Dashboard
6. extract Quest panels last because they carry the most progression risk

For every extraction, keep the backend contracts and exact behavior intact.
