# THE SYSTEM 2.8.3 — Open Library Reader

Built on the stable 2.8.2 Quest and System Intelligence hotfix.

## What changed

- Adds an authenticated `open_library_resolve` route to `system-content-api`.
- Resolves the active Mage Archive title against Open Library by title and
  author when the player opens the reader.
- Uses a confirmed public Internet Archive identifier to open a readable
  edition inside THE SYSTEM.
- Keeps Google Books as a legal embedded-preview source.
- Shows a direct Open Library / Internet Archive provider button for a lending
  or catalog record instead of pretending that it is a free full book.
- Keeps the owned-PDF reader as the final legal fallback.

## Preserved

- Mage-only Archive access and all existing Archive UI/progress.
- Server-authoritative reading XP, Knowledge Rank, completion and rewards.
- Existing Google Books, OpenAI, YouTube, quest, Boss, inventory and Fuel work.
- All player data and browser cache. No migration or reset is required.

## Security and access rules

Open Library does not need a key for this feature. The browser only calls the
existing authenticated Supabase function; the function validates the player
session, rate-limits requests, caches results briefly, and only returns
Open Library / Internet Archive URLs it constructs itself.

An Internet Archive iframe is used only when the Open Library result confirms
public readability. Borrow-only, restricted and catalog-only records never get
an in-app "full book" label.
