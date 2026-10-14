# Release check — 2.9.4

Validated 25 September 2026, built on stable 2.9.3.

## Changes

- Added a first-login Player Foundation Scan with identity, goal, experience, optional body metrics and real-world routine questions.
- Added activity, daily time, meal rhythm, obstacles, food preferences, food budget and training-access inputs before class selection.
- Added three class-fit suggestions. They are advisory only: no class is preselected and the player must choose one.
- Added a player-controlled Cut / Maintain / Bulk choice. The system provides a sensible starting suggestion and optional calorie/protein estimates, but does not force a diet direction.
- Added a concise first-week plan tied to the chosen class, food rhythm, constraints and available time.
- Added a secure authenticated backend RPC which validates and persists only the Foundation Scan and Fuel starting data for its owner. It cannot award XP, attributes, credits, quest completion, timers or rewards.
- Added a login-gate notice so the Foundation Scan is clearly part of new-player setup, not a hidden later screen.

## Executed checks

| Check | Result |
| --- | --- |
| Node regression suite | 18 tests passed |
| Production Vite build | Passed |
| Mobile Foundation Scan walkthrough | Passed at 390px; no horizontal overflow or page errors |
| Choice safety | Passed: no automatic class selection; player-selected Cut persisted despite Bulk suggestion |
| Live PostgreSQL Foundation Scan regression | 7 checks passed inside a rolled-back transaction |
| Backend ownership | Passed: RPC only updates `auth.uid()`'s profile and validates every allowed value |

## Backend applied

- `20260925154139_player_foundation_scan_v2_9_4`
- `20260925155346_player_foundation_scan_routine_preferences`

The production chunk remains above Vite's 500 kB advisory threshold. That is an existing performance opportunity; this release does not add a blocking build error.

## Reproduce

```bash
npm ci
npm test
npm run build
```

`tests/backend-foundation-scan.sql` is transaction-isolated and ends with `ROLLBACK`; run it against the matching project database as its owner to repeat the backend checks.
