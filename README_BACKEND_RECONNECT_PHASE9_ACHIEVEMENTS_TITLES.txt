THE SYSTEM — PHASE 9: ACHIEVEMENTS + TITLES

ACHIEVEMENTS
- Evaluated by backend progression facts only.
- Quest count, streak, Boss rank, mastered skills, GPS/performance,
  wealth logs, completed goals, proof count and level are backend criteria.
- Achievement XP is awarded once by the server.
- Journey receives ACHIEVEMENT_UNLOCKED automatically.
- Locked achievements now show authoritative progress/target in the UI.

TITLES
- FIRST BLOOD, SCHOLAR, EARLY RISER and level/class/ascension titles unlock backend-side.
- user_titles is the source of truth.
- A player can equip only a title they actually unlocked.
- Equipping one title automatically unequips the previously equipped title.
- The Journey screen now shows unlocked titles and EQUIP TITLE controls.
- equipped title state persists in Supabase.

BOOTSTRAP
- cloudTitles, equippedTitle and cloudAchievements are mapped from system-api bootstrap.
- Opening Journey refreshes progression orchestration first, then reloads authoritative state.

REPLACE ONLY:
src/App.jsx
src/systemCloud.js

KEEP .env.local
RUN npm run dev
