# THE SYSTEM 2.9.0 — Daily Command + Quest Rotation

## What changed

- Added a compact **Daily Command Brief** to the Dashboard.
- The brief reads real Supabase data: the accepted Must Quest, today’s Class
  directive, unspent attribute credits, level and streak.
- The Class directive shown in the Dashboard is the same directive shown in
  **Quests**. It is no longer a separate browser-only recommendation.
- Added four realistic Class directives for every class, bringing each class
  pool to seven live directives.
- Added class-specific Adaptive directives for Assassin, Tank, Mage, Ranger
  and Commander.
- Class and Adaptive selection exclude a recently used directive for seven
  days when another compatible option exists.
- Daily generation is serialized per player and date, so simultaneous sessions
  cannot create two Class directives for one day.
- Live library proof types now pass through to the existing proof flow instead
  of being overwritten by a title heuristic.

## What did not change

- The four quest categories remain **Must, Class, Adaptive and Rare**.
- Must Quests still require an accepted 24-hour server-owned contract.
- The Daily Command is read-only. It cannot award XP, accept a quest, spend a
  credit, change attributes or bypass proof.
- Quest completion, XP, streaks and attribute credits remain Supabase
  authoritative.

## Quick check

1. Sign in and open **Dashboard**.
2. Confirm the Daily Command shows three slots: Must, Class and Progression.
3. Open **Quests** and confirm the Class card has the same title and XP as the
   Class slot in the brief.
4. Complete an Adaptive quest, reopen it, and confirm another compatible
   directive is selected instead of a recent repeat where the catalog allows.
5. Check **Attributes**; the credit number in the brief must match the live
   available-credit total.
