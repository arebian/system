# THE SYSTEM 2.8.8 - Embedded Public-Domain Archive

## What changed

- Added **The Art of War** as a live E-rank Mage Archive book.
- Bundled a complete 111-page public-domain PDF edition directly in the app.
- The reader now chooses this local edition before Google Books, Open Library or Internet Archive.
- Page arrows use the real 111-page PDF limit and retain the existing Archive page-turn animation.
- The existing active-reading tracker remains: time counts only while the reader is open, visible and recently active.
- Added a visible **READ INSIDE** mark on the book card and a **SOURCE & LICENSE** toolbar link.

## What did not change

- Commercial books are not copied into the app. They still use authorized previews, legal provider links or the player's own PDF.
- Archive XP, Knowledge Rank, logging and completion remain Supabase-authoritative.
- Existing selected books and their progress are untouched.

## Backend

The production Supabase catalog now includes the `the-art-of-war` E-rank record and sends its `embedded_reader_key` through the authenticated Archive RPC.

## Quick check

1. Log in as a Mage and open **Grand Archive**.
2. Find **The Art of War** on the E-rank shelf and press **READ NOW**.
3. Confirm the focused reader opens directly to page 1, without a loading/black external viewer.
4. Use the page arrows; page 2 should enter with the existing smooth transition.
5. Close with **SAVE TIME & RETURN TO GRIMOIRE** and confirm the minutes field receives the tracked full minutes.
