THE SYSTEM — BACKEND RECONNECT PHASE 2: QUEST COMPLETION

STARTING POINT
Stable Backend Reconnect Phase 1.

BACKEND
system-api is now v6.
A server-side complete_quest_by_title adapter validates the displayed
Platform V1 quest against quest_library, player class and level.

CLIENT CHANGES
- Daily/class quest completion no longer calls addXP locally.
- MUST quest completion no longer calls addXP locally.
- Wake quest now:
  1. syncs the player's routine to the backend,
  2. performs a backend WAKE check-in,
  3. completes NO-SNOOZE only when backend status is ON_TIME.
- After completion, the client reloads authoritative XP/level/attributes/
  streak/momentum from system-api bootstrap.
- Local quest UI flags/logs are applied only to local cache and never used
  as the source for progression.
- Bootstrap preserves UI-only quest bookkeeping from localStorage while
  refusing to take XP/level/attributes/streak/momentum from localStorage.

NOT CHANGED YET
- MUST quest expiry/failure timers still use the legacy client path.
  That is intentionally Phase 3.
- Adaptive quests remain legacy.
- Training, Boss, Skills, GPS actions are unchanged.

FILES TO REPLACE
src/App.jsx
src/systemCloud.js

RUN
npm run dev

TEST
1. Sign in.
2. Open Quests.
3. Complete a class quest or MUST quest.
4. XP should update after the backend refresh.
5. Refresh the browser — completion UI should remain cached locally.
6. Try completing the same quest again — the backend idempotency/duplicate
   protection prevents a second reward.
