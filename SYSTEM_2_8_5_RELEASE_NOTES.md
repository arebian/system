# THE SYSTEM 2.8.5 — Class Alignment + Verified Credits Stability

## What changed

- New profiles now receive class-aligned attribute baselines. Mage starts
  knowledge-first; Tank is physical-first; Assassin is speed/focus-first;
  Ranger is endurance/speed/recovery-first; Commander is
  charisma/discipline/focus-first.
- Existing player attributes are preserved. The only safe legacy calibration
  targets untouched rows that are exactly the former all-10 placeholder values
  and have no attribute-history events.
- Verified quest completion can create one to three server-issued attribute
  credits, subject to a server-owned daily cap. The player spends credits only
  on the eligible attributes attached to that quest.
- Credit allocation is atomic, authenticated, audited, and idempotent at the
  quest level. The client cannot mint credits, change the eligible list,
  overspend a credit, or allocate a credit twice.
- Attributes now show class tiers and class-alignment guidance, with a clear
  Attribute Credit Console and success/error feedback.
- Adaptive Quest repair remains active in the backend, including compatible
  class-neutral Physical Standard directives.
- The live `system-content-api` is updated to the current authenticated reader
  resolver for legal Open Library / Internet Archive reading paths.
- The UI avoids rendering the hidden persistent training surface, reducing
  unnecessary paint work during navigation.

## Backend state

Already deployed to the production Supabase project:

- Adaptive resolver repair
- attribute credit ledger + allocation history tables with RLS
- authenticated-only credit allocation RPC
- allocation foreign-key index
- current `system-content-api` Edge Function (version 6, JWT verification on)

## Safety guarantees

- No player profile, quest, XP, streak, or existing earned attribute is reset.
- Credits are issued only by the quest-completion RPC after it receives the
  normal verified proof receipt.
- A credit can only be allocated by its owner and only to its server-computed
  eligible attributes.

## Verification completed

- JavaScript tests: 36 passing
- Production build: passing
- Database checks: Adaptive resolver, credit ledger RLS, authenticated-only
  allocator, and the allocation foreign-key index all confirmed live

The only build note is Vite's existing non-blocking large-chunk advisory for the
single large `App.jsx` bundle. This release does not split that component because
doing so would create a much riskier change than the targeted stability fixes.
