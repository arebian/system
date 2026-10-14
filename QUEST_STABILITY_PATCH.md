# THE SYSTEM — Quest Stability Patch

Baseline: THE SYSTEM 2.5.1.1 Styles Runtime Hotfix

This patch keeps the existing quest rules, Supabase authority, proof flow,
timers, penalties, Boss quests, and 2.5.1.1 runtime hotfix intact.

## Changes

- Prevented rapid repeated quest taps from opening duplicate proof flows or
  sending duplicate completion requests while a quest action is in flight.
- Removed the Must Quest local 24-hour timer fallback. Completion now remains
  locked until the backend returns an authoritative expiry timestamp.
- Fixed narrow-screen quest cards so their side labels become readable
  horizontal headers instead of inheriting the desktop vertical rail.
- Made proof modal actions stack cleanly on very narrow screens.

## Files

- `App.jsx`
- `styles/system.css`

## Validation

- JSX bundle parse passed with esbuild.
- Existing 8 foundation tests passed.
- Runtime stylesheet reference remains present and obsolete inline `styles`
  blocks remain removed.

## Install

Copy the patched `App.jsx` over:

`/Users/bwoy/the-system/src/App.jsx`

Copy the patched `styles/system.css` over:

`/Users/bwoy/the-system/src/styles/system.css`

Keep all other current 2.5.1.1 files unchanged.
