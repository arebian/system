# THE SYSTEM 2.8.2 — Quest + AI Hotfix

Built on the stable 2.8.1 AI, Archive + Fuel repair.

## Quest repair

- Restores the Quest page when the Boss Gate renders.
- Places the Raid Entry Key check inside the Boss Gate where it is used.
- Recognizes both readable inventory names such as `Raid Entry Key` and
  authoritative slugs such as `raid-entry-key`.
- Keeps all Boss assignment, completion, XP and inventory rules server-owned.

## System Intelligence expansion

- Sends a small, guidance-only snapshot of the current player screen to the
  authenticated responder. It never authorizes a gate or changes progression.
- Extends the cloud AI instructions to cover the whole app: progression, XP,
  streaks, Daily / Must / Adaptive quests, proof, training, GPS, Boss Gate,
  Class Special, Fuel, Archive, Inventory, Journey, Trophy Room, routines and
  settings.
- Makes the no-key fallback useful for common questions such as “How do I
  level up?”, “Why is my Boss gate locked?”, and “How does the quest proof
  work?” instead of returning one generic reply.

## Preserved

- Existing profile, quests, streaks, XP, logs, inventory and player data.
- The server-authoritative Boss Gate and progression rules.
- The server-only `OPENAI_API_KEY` requirement for flexible cloud AI.

No migration, cache reset or progress reset is required.
