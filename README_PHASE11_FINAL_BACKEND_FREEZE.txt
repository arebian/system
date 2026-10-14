THE SYSTEM — PHASE 11 FINAL BACKEND AUDIT / FREEZE

WHAT THIS PATCH DOES
- Generic browser cloud sync no longer writes XP, level or attributes.
- syncStructuredProfile is now a permanent no-op compatibility shim.
- Direct authenticated RLS write policies were removed from progression-critical tables.
- Profile creation uses system_initialize_profile.
- Adaptive quest completion uses backend quest completion.
- Rare event completion uses backend quest completion.
- Old Progress > Mastery panel cannot grant mastery, XP or attributes.
- Goal creation, progress updates and claiming use dedicated backend RPCs.
- Goal XP, +2 attribute and reward are awarded by the backend only.
- Performance, wealth and learning records use dedicated RPCs.
- Journey proof archiving uses proof_records RPC.
- Manual Inventory gear is stored backend-side as USER_DECLARED and explicitly carries no authoritative stats.
- Manual Reward creation is blocked; Reward Vault is earned-only.
- Dead local GPS reward completion code was removed.
- Legacy progression delta writer was removed.
- saveProfile is now local UI/cache only, except safe identity changes.

FINAL STATIC AUDIT
{
  "addXP calls": 1,
  "bossDamageFromTraining calls": 1,
  "addReward calls": 1,
  "syncStructuredProfile calls": 0,
  "recordProgressionDelta calls": 0,
  "direct .from profiles writes": 0,
  "direct .from attributes writes": 0
}
Remaining addXP owners: ['addXP']
Unresolved local imports: []
systemCloud syntax valid: True

IMPORTANT
The addXP helper definition may remain for compatibility if referenced by non-authoritative UI calculations,
but no migrated authoritative completion flow should call it.

REPLACE ONLY:
src/App.jsx
src/systemCloud.js

KEEP:
.env.local
public assets

RUN:
npm run dev

THIS IS THE BACKEND FREEZE CHECKPOINT BEFORE THE UI REDESIGN.
