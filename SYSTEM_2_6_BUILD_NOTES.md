# THE SYSTEM 2.6.0 — CLASS GROWTH & FUEL

This release is built from the current **2.5.1.1** workspace. It is a surgical
upgrade: current authentication, Supabase authority, XP, Must Quest penalties,
training, inventory, Journey, Intelligence, Archive reader and mobile layout
remain in place.

## Included

### Quest / Must Quest repair

- `STRUCTURAL CHECK` is explicitly a **Performance Proof** directive.
- Must directive matching now checks both the title and assigned day.
- A Must Quest is completable only after a valid server expiry timestamp is
  returned.
- Acceptance stores the authoritative quest ID and avoids writing an old
  profile snapshot over a newer verified completion.
- Honor proof now requires a deliberate confirmation.
- Video proof is supported for Class Training without changing the existing
  image-proof flow.

### Grand Archive recovery shelf

- A Mage never sees an empty Archive just because the `system_mage_archive_state`
  RPC is delayed, empty or temporarily unavailable.
- The recovery shelf provides ranked book choices and a local reader/log for
  continuity.
- Recovery-mode reading is visibly marked and never awards fake XP or Knowledge
  Rank. Official Archive progression automatically resumes through the existing
  Supabase RPC when it reconnects.

### Class Specials

- New **Class Special** navigation area.
- Mage routes directly to the Grand Archive.
- Commander has **Command Presence**: short private self-recordings, review,
  reflection and protected proof submission.
- When the existing cloud Training catalog includes a Commander communication /
  charisma skill, the verified video is submitted through the current
  `submit_skill_attempt` path. Only the backend can then award progression.
- If the current catalog has no matching skill, the private proof remains
  recorded and the UI clearly says that no Charisma or XP was awarded. It never
  fabricates progress in the browser.

### Fuel System

- New **Fuel System** navigation area.
- First launch asks only **Cut**, **Maintain** or **Bulk**; it uses the selected
  player class automatically.
- Class-specific meal rhythm and food suggestions are shown for Tank, Ranger,
  Assassin, Mage and Commander.
- Supports daily calorie/protein targets, meal logging and seven-day logging
  consistency.
- Fuel logs are personal UI records stored locally with the profile cache. They
  are not gameplay XP, attributes or medical prescriptions.

## Supabase / API prerequisites already used by this build

No service-role key or provider secret is included in this archive.

- The existing private `proofs` bucket must keep its current authenticated
  upload policy for Commander video proof to save.
- The existing `system-content-api` function supplies Google Books and
  Commander tutorial results. `GOOGLE_BOOKS_API_KEY` and `YOUTUBE_API_KEY`
  should remain set as Supabase Edge Function secrets for the best provider
  results.
- The current backend Training catalog should contain a Commander skill whose
  name or grouping mentions communication, leadership, confidence, public
  speaking, social skills or charisma if Command Presence is expected to
  progress through the existing authoritative skill system.

## Validation completed

- `npm test` — 20 tests passed.
- `npm run build` — Vite production build passed.

## Install

Use the complete archive replacement instructions in `INSTALL_2_6.md`.
