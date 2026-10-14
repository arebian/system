# THE SYSTEM 2.7.0 — Live Time + Archive Reader

## What changed

- An unlocked Grand Archive title now uses **READ NOW**. It becomes active when needed and then opens the in-app reader automatically.
- The reader looks up an authorized Google Books preview or full edition first. If that edition is not legally embeddable, the player can read an owned PDF in the same reader instead.
- Must directives are now always exactly 24 hours from their backend acceptance timestamp. Old malformed 29-hour windows were repaired.
- The Must countdown uses the backend clock offset, so a device with the wrong local time cannot make the displayed deadline drift.
- Streaks now mean consecutive days with at least one verified `DAILY` quest. Extra quests on the same day no longer add artificial streak days.

## Backend migration included and applied

`supabase/migrations/20260912_2700_live_quest_time_and_streaks.sql`

The migration is already applied to the connected Supabase project. Keep this file in source control so another environment receives the same guarantees.

## Check before release

1. Sign in as a Mage, open an unlocked book, and confirm that **READ NOW** opens the Archive reader.
2. Check one book with an authorized Google Books edition and one without; the latter should clearly offer the owned-PDF fallback.
3. Accept a Must directive, refresh the browser, and confirm the expiry is still exactly 24 hours after acceptance.
4. Complete multiple non-daily quests on one day; the streak must not jump multiple times.
