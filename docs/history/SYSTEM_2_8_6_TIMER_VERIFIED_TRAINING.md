# THE SYSTEM 2.8.6 — Timer-Verified Training

## What changed

- Core Foundation no longer starts a GPS mission. The old GPS detector matched
  the `run` inside **trunk control**; it now uses whole movement words and the
  backend’s explicit verification mode.
- Stationary workouts with timed holds open a focused, no-scroll countdown.
- Core Foundation gets a 20-minute server-owned session timer plus automatic
  set/rest guidance for Hollow Body Hold, Plank, and Side Plank.
- Closing the popup does not reset the session. Reopening the workout resumes
  the existing authoritative timer.
- Training can only be claimed when the server timer reaches zero. The browser
  cannot fast-forward or self-award the completion.
- GPS remains for actual movement: running, walking, cycling, hiking, trails,
  and swimming.

## Backend confirmed live

- Core Foundation verification mode: `TIMER`
- Timer start/complete RPCs: live
- Timer-session row-level security: enabled
- Anonymous timer calls: blocked
- Signed-in player timer calls: allowed with backend ownership checks

## Verification completed

- 41 automated tests passing
- production build passing

The existing Vite large-bundle advisory remains non-blocking and predates this
targeted patch.

