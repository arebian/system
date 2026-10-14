THE SYSTEM — BACKEND RECONNECT PHASE 7: BOSS AUTHORITY

BACKEND
- Boss assignment is server-selected by class + level.
- Player cannot construct a custom Boss.
- Boss HP is server-owned.
- Workout/GPS damage already updates backend Boss HP.
- Boss objectives are now updated through a validated backend RPC.
- Boss defeat resolves only when HP = 0 AND all objectives are complete.
- Boss XP is awarded server-side.
- Boss reward is created server-side.
- A Boss Trophy is now added to user_inventory server-side and marked showcase=true.
- Duplicate Boss reward/trophy creation is prevented.

CLIENT
- Existing Boss Gate visual UI remains.
- REQUEST/ACCEPT BOSS calls backend assignment.
- Objective checkbox updates backend and refreshes state.
- CLAIM BOSS calls backend resolution.
- No local Boss XP/reward/trophy creation remains in claimBoss.
- Hydration now includes Boss HP/max HP/reward/systemAssigned fields.

CRITICAL SAFETY FIX
syncStructuredProfile no longer deletes/recreates boss_quests or
boss_quest_objectives from browser profile state. Unrelated local profile
saves can no longer overwrite authoritative Boss data.

NOTE
system-api v8 already contained assign_boss and resolve_boss routes.
The new objective setter is an authenticated, ownership-validated high-level
RPC and does not expose raw Boss damage/XP helpers.

REPLACE ONLY
src/App.jsx
src/systemCloud.js

KEEP .env.local
RUN npm run dev
