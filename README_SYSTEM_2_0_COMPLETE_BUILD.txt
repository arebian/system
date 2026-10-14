THE SYSTEM 2.0 — COMPLETE REDESIGN BUILD

BASE
- Built directly on Phase 11.9 (page swipe removed).
- Phase 11 backend authority remains unchanged.

SYSTEM 2.0 VISUAL LAYER
- New cinematic app shell and sticky HUD navigation.
- Stronger dark/light contrast.
- Five distinct class atmospheres without cheap neon/pixel styling.
- Dashboard hero rebuilt visually around class identity and level state.
- Level 101 Ascension gets a separate gold/omega visual state.
- Quest Control, MUST quests, Boss Arena, Attributes, Training, Skill Tree, GPS, Progress, Inventory, Journey, System page, Options and modals receive the same design language.
- System Intelligence remains fixed to viewport, working, scrollable and wide.
- Exercise visual/demo links from Phase 11.8 remain.
- Music/SFX redesigned controls remain.
- GPS persistence/wake-lock/recovery remains.
- Horizontal page swipe remains REMOVED.

FUNCTIONAL SAFETY
- No Supabase progression authority was moved back to the browser.
- systemCloud.js is unchanged by the redesign.
- Existing auth/bootstrap, quests, training, mastery, proof, Boss, inventory, titles and AI flows are preserved.

INSTALL
1. Back up your current /Users/bwoy/the-system folder.
2. Replace it with this package, OR copy the package contents into it.
3. Keep your .env.local if you prefer your existing environment file.
4. Run: npm install
5. Run: npm run dev

BUILD CHECK
The handoff package is intended to be delivered only after `npm run build` succeeds.
