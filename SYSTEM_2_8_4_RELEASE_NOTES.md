# THE SYSTEM 2.8.4 — READER MODAL + ADAPTIVE REPAIR

## Included fixes

- Grand Archive now opens in a portalled, viewport-centered reader modal.
- Opening a book locks background scrolling and restores the exact Archive position when closed.
- Public Open Library / Internet Archive editions can upgrade to a native PDF surface when the public item exposes a PDF. Imported owned PDFs use the same surface.
- Native PDF page arrows now move the actual PDF page and use a compact page-turn transition. Provider readers remain available when no public PDF exists.
- Theme switching no longer cross-fades full light/dark backgrounds; sticky chrome no longer uses expensive backdrop blur; class atmosphere motion is static to reduce scroll work.
- Assassin light atmosphere is forced to a muted crimson treatment rather than a purple blend.
- Adaptive Quest now requests a compatible `STANDARD` directive from a protected backend resolver, instead of selecting arbitrary class-specific Must quests in the browser.
- Adaptive completion opens the normal proof modal and sends that proof to the authoritative quest RPC.
- The migration adds three generic Physical Standard directives so a player whose movement signal is weakest can receive a valid directive.

## Backend step

Run the included migration once, then deploy `system-content-api`. The install note contains the exact commands.

## Verification

- `npm test` — 32 passing tests
- `npm run build` — passed
- `system-content-api` TypeScript syntax — passed with the local parser

The Deno dependency type check could not fetch JSR manifests from this workspace's restricted network. It did not indicate a source error; the Edge function should still be deployed through Supabase as normal.
