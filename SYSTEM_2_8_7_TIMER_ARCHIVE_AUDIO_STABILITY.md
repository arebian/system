# THE SYSTEM 2.8.7 — Timer, Archive & Audio Stability

## Fixed

- Removed the stray `activeTimer` render from `MageArchive`. It caused the
  Archive to fail immediately with `activeTimer is not defined`.
- Restored the timer modal to `Training`, where that state is defined.
- Closing the timer no longer throws away the active client session. Training
  now exposes a live countdown card and **OPEN ACTIVE TIMER** so the player can
  always reopen the focused timer window.
- Raised the portalled timer above tab/page stacking contexts so it cannot be
  hidden behind the current page.
- Added **× DISCARD CLIP & RETAKE** to the Commander self-recording flow.
  It discards only the local, unsubmitted clip and clears the review text.
- Changed background music activation to an explicit Class Soundtrack toggle.
  Normal SFX clicks and key presses no longer start music.

## Archive

The Archive RPC now returns optional curated legal reader URLs. The selected
public-domain slots receive stable Project Gutenberg links:

- `Walden, and On The Duty Of Civil Disobedience`
- `The Republic`
- `The Prince`
- `An Inquiry into the Nature and Causes of the Wealth of Nations`
- `Meditations`
- `The Brothers Karamazov`

The first four replace untouched catalog slots only. Any book already assigned
to a player is preserved. All other titles retain the existing Google Books /
Open Library resolver and the owned-PDF fallback.

## Backend

Three migrations are included and already deployed to the production project:

1. `mage_archive_curated_reader_links`
2. `mage_archive_rpc_permissions`
3. `mage_archive_security_hardening`

Archive RPCs now require authenticated users; anonymous callers cannot open,
start, log, or complete Archive book actions.

## Verification

- `npm test` — 44 passing tests
- `npm run build` — production build succeeds
- Production Archive RPC permissions checked: anonymous denied, authenticated
  users permitted
