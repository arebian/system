# Install — THE SYSTEM 2.5.1 Foundation Hardening

## Source

This release is built directly on **THE SYSTEM 2.5 — API CORE**.

It is a stabilization release. No intentional gameplay redesign is included.

## Replace in `/Users/bwoy/the-system/src/`

- `App.jsx`
- `systemExternal.js`

## Add in `/Users/bwoy/the-system/src/`

- `systemExternalCore.js`
- `styles/system.css`

## Unchanged but included for matching-build reference

- `systemAI.js`
- `systemAwareness.js`
- `systemCloud.js`

## Edge Functions

Updated source is included for:

- `supabase/functions/system-content-api/`
- `supabase/functions/system-intelligence-responder/`

For the current Supabase project these were deployed during the 2.5.1 hardening pass:

- `system-content-api` — ACTIVE v3
- `system-intelligence-responder` — ACTIVE v4
- `system-api` — remains ACTIVE v8 and unchanged

If you move THE SYSTEM to a different Supabase project, deploy the included function sources there as well.

## Tests

No extra test framework is required for the included foundation tests.

From the extracted release folder:

```bash
node --test tests/*.test.mjs
```

Expected: **8 passing tests**.

## Run the app

```bash
cd /Users/bwoy/the-system
npm run dev -- --port 5174
```

If available, also run:

```bash
npm run build
npm run lint
```

## Manual smoke test

1. Sign in using the normal account flow.
2. Confirm Dashboard XP line is visible.
3. Open and close System Intelligence with the pinned X.
4. Ask System Intelligence a normal question.
5. Search for a tutorial and play it in-app.
6. Open the Mage Archive reader and search an online book.
7. Complete one safe test quest through normal proof/backend flow.
8. Verify active-time tracking still counts and pauses on idle.
9. Resize to a narrow/mobile viewport and verify no header/close-button clipping.

## Rollback

Immediate rollback: THE SYSTEM 2.5 API Core.

Emergency fallback: locked Baseline 2.1.1.
