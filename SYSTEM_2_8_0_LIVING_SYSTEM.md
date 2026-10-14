# THE SYSTEM 2.8.0 — Living System Update

Built on the stable 2.7.0 Archive and exact-Must-timer patch.

## New live behaviour

- **Boss Gate:** A real `RAID ENTRY KEY` now lives in Inventory and is checked by Supabase before any Boss is assigned. It is earned at level 5 with a 3-day verified Daily streak.
- **Commander:** The special is now self-recording only. It opens the front camera, records privately, and removes outside tutorial/video watching from the flow. The point is camera-lens eye contact.
- **Three dedicated specials:** Tank gets **Iron Ledger**, Assassin gets **Silent Target**, and Ranger gets **Trail Marker**—built around repeatable strength proof, deep-focus results, and GPS field proof respectively.

## Live systems retained from the stable baseline

- System Intelligence remains server-side/advisory only; it cannot manipulate XP, level, proof, Boss damage or rewards.
- GPS sessions use browser location plus backend session verification.
- Fuel already asks for bulk, cut or maintain and uses the player class to set meal rhythm and food guidance.
- Routine, Journey, logs and Trophy Room retain their authoritative existing paths.
- Google OAuth keeps per-account sessions in Supabase. The Supabase dashboard still needs the production URL added under Auth redirect URLs and the Google provider enabled; that is project configuration, not a client-side secret.

## Backend migration

`supabase/migrations/20260912_2800_boss_key_gate.sql` is included and already applied to the connected project.
