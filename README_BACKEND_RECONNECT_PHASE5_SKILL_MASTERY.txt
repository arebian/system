THE SYSTEM — BACKEND RECONNECT PHASE 5: SKILL TREE / MASTERY

BACKEND AUTHORITY
- Skill availability checks class, level and prerequisites.
- Physical/result mastery attempts are recorded server-side.
- A typed number or note alone cannot verify physical mastery.
- Physical skills require a VERIFIED proof record before mastery.
- Mage/learning mastery is derived from structured learning_records.
- GPS-based endurance mastery is derived from verified GPS sessions.
- Mastery XP is server-awarded once.
- +2 primary attribute on mastery is now server-authoritative.
- user_skills MASTERED state determines workout unlock eligibility.

CLIENT
- Skill Tree UI remains unchanged.
- Physical VERIFY MASTERY no longer flips masteredSkills locally.
- Mage learning records no longer award XP/INTELLIGENCE locally.
- After verified mastery, authoritative profile/attributes/skills are reloaded.
- bootstrap builds profile.masteredSkills from backend user_skills.

IMPORTANT
The old PROOF / RESULT NOTE field is still accepted as an attempt note,
but it is NOT treated as independent proof. A future Proof UI patch will
connect image/video proof_records to physical skill attempts.

REPLACE ONLY
src/App.jsx
src/systemCloud.js

KEEP .env.local
RUN npm run dev
