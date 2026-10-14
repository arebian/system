# THE SYSTEM 2.5.1.1 — Stability Fixes

This build starts from the current 2.5.1.1 foundation source and keeps the
existing gameplay rules, Supabase authority, proof flow, and quest catalog.

## Fixed

- Auth bootstrap now exits to sign-in after a bounded 12-second session check
  instead of leaving the cloud loader spinning forever.
- Google sign-in releases its button after a bounded handoff window when the
  provider or redirect configuration does not navigate.
- Login and registration controls now have their own theme variables, so class
  and gender selections visibly change on the unauthenticated screen.
- Proof modal close/cancel actions are locked while proof is uploading or being
  verified, preventing duplicate quest submissions.
- Opening quest proof now locks the background at the exact current scroll
  position; the quest board does not jump up or down while the popup is open.
- Honor-system quest buttons now use the same proof popup instead of silently
  completing inline.
- Quest completion, Must acceptance, proof uploads, signed proof URLs, and the
  main system API now surface controlled timeout errors instead of hanging.
- Must failure reconciliation only marks a quest failed after the backend
  confirms an expired penalty, and it preserves a completion that won a race.
- Local SFX files are present for click, success, impact, and level-up events;
  the app no longer requests missing WAV files and receives an HTML fallback.
- Package/index metadata and the test command now identify the current 2.5.1.1
  build.

## Verify

```bash
npm ci --ignore-scripts
npm test
npm run build
```

The included tests should report 8 passing tests. The Supabase project still
needs its deployed `system-api`/RPC contracts and Google redirect settings;
those backend settings are not changed by this frontend stabilization build.
