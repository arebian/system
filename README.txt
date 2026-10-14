THE SYSTEM 2.9.7 — AUTOMATIC LOGIN MOTION

Read START_HERE_2_9_7.md for the current installation instructions, changes,
completed checks and remaining real-account launch checks.
Install the complete package with install-update.sh; the app now uses
App.jsx, SystemGame.jsx and separate screen modules.

The notes below describe the historical platform baseline. Its single-file
replacement instructions do not apply to this 2.9.7 update.

THE SYSTEM — PLATFORM BASELINE V1 (HISTORICAL)

PURPOSE
This is the stabilized platform snapshot after the small-patch phase.
Future work should branch from THIS package instead of older Patch ZIPs.

STABILITY FIXES
- Restored and hardened Profile / Options button interaction.
- Decorative class emblem is permanently non-interactive.
- Canonical z-index stack for header, navigation, AI, Options and modals.
- Removed the known invalid Dashboard activeQuests reference.
- Added a React runtime boundary: future render errors show Recovery Mode
  instead of a blank dark page.
- Verified App.jsx parses with zero JSX syntax diagnostics.
- Verified all relative JS imports in the package exist.
- Verified all CSS public URL assets referenced by App.jsx exist.
- Scanned for known invalid profile collection references.

PLATFORM FEATURES PRESERVED
- Supabase authentication and JWT refresh handling
- Player registration, age, gender and class
- Recorded male/female initialization voices
- Login -> Welcome -> Dashboard transition
- Dashboard command polish + XP ring + status strip
- Profile & Routine / sleep shift configuration
- Immersive dark/light class themes
- Class emblem atmosphere
- Floating side System Intelligence shell (offline until AI backend)
- Skill Tree -> Workout progression
- Learning proof and mastery tests
- GPS tracking and GPS quest/workout verification
- Must quests, proof engine and consequences
- Rare event scanner
- System-assigned Boss Quests
- Boss HP and automatic workout damage
- Inventory, rewards, goals, journey and Level 101 evolution
- Class music and SFX

IMPORTANT
Use this package as the new development base.
Do not apply V22/V23 or Patch 1-15 App.jsx files on top of it.

LOCAL PROJECT
Replace src/App.jsx with the baseline App.jsx.
Keep your existing .env.local if it contains your live Supabase values.
The included public assets may be copied as a complete public folder if needed.

RUN
cd /Users/bwoy/the-system
npm run dev
