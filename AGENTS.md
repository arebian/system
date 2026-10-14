# AGENTS.md — THE SYSTEM

## Project Identity

**Project:** THE SYSTEM  
**Tagline:** REAL LIFE / RPG  
**Current active build:** 2.9.7 — AUTOMATIC LOGIN MOTION  
**Emergency fallback baseline:** 2.1.1  
**Frontend:** React + Vite + JSX  
**Backend:** Supabase + PostgreSQL + RPC functions + Edge Functions  
**Primary project folder on the user's Mac:** `/Users/bwoy/the-system`

THE SYSTEM is a real-life RPG application.

The core metaphor is:

- Real life = the game
- The user = the player
- Goals = quests
- Real actions = XP
- Personal development = attributes
- Repeated skill development = training
- Books/learning = knowledge progression
- Big goals = boss quests
- Rewards/possessions = inventory
- Major achievements = trophies
- Long-term growth = levels
- Level 101 = Ascension

This application must NOT feel like:
- a generic habit tracker
- a corporate productivity dashboard
- a simple to-do list
- a childish mobile game

The desired feeling is:
- dark
- cinematic
- premium
- anime/RPG-inspired
- mysterious
- class-specific
- immersive
- serious

---

# 1. NON-NEGOTIABLE WORKFLOW RULES

## 1.1 Always start from the current master

The current master is:

**THE SYSTEM 2.9.7 — AUTOMATIC LOGIN MOTION**

Do not reconstruct the app from memory.
Do not use old prototypes.
Do not replace the app with a smaller example implementation.
Do not import demo files as production replacements.

When making changes:
1. inspect the current repository first
2. identify the exact component/function/style involved
3. patch surgically
4. preserve all unrelated systems
5. run syntax/build checks
6. report exactly what changed

---

## 1.2 Never downgrade the project

The real `App.jsx` is a very large production file.

If a candidate replacement is dramatically shorter than the current production file, assume it is incomplete unless explicitly verified otherwise.

Never replace the production application with:
- visual demos
- proof-of-concept files
- mockups
- hardcoded sample apps
- simplified prototypes
- old 2.x versions

---

## 1.3 Treat 2.1.1 as the locked emergency baseline

Baseline name:

**BASELINE 2.1.1**

This baseline is the known-safe fallback.

Never overwrite the 2.1.1 baseline archive.
If a future build becomes stable, create a new numbered baseline instead.

If the user says:

> restore baseline

restore the known-good 2.1.1 version unless the user explicitly names another version.

---

## 1.4 Preserve version lineage

Known version chain:

- 2.1.1 — Locked fallback baseline
- 2.2 — Visual Evolution
- 2.2.1 — Grand Archive visual polish
- 2.2.2 — Grand Archive reader
- 2.3 — Adaptive Intelligence
- 2.3.1 — Dashboard XP visibility hotfix
- 2.3.2 — System Intelligence X-button hotfix
- 2.4 — System Awareness
- 2.5 — API Core (OpenAI + in-app tutorials + online Archive reader)
- 2.5.1 — Foundation Hardening (root runtime boundary, extracted CSS, API timeouts/cache/rate limits, tests, docs)
- 2.6 — Class Growth + Fuel
- 2.6.1 — Light Clarity + fixed quest proof placement
- 2.7.0 — live Archive reader, exact 24-hour Must timers and true daily streaks
- 2.8.0 — Boss key gate, class specials and Commander private self-recording
- 2.8.1 — AI status/response repair, Archive embeddable-edition preference and class-specific Fuel meal plans
- 2.8.2 — Quest Boss Gate runtime repair, robust Raid Entry Key detection and broader System Intelligence guidance
- 2.8.3 — Open Library / Internet Archive reader resolution with legal in-app embeds and direct provider links
- 2.8.4 — focused Archive reader modal, public-PDF enhancement, Adaptive directive compatibility/proof repair, and scroll/theme stability pass
- 2.8.5 — class-aligned attribute baselines, verified server-issued quest credits with player allocation, reader content backend refresh, and stability hardening
- 2.8.6 — GPS classifier repair, server-verified focused workout timers, and guided set/rest countdowns
- 2.8.7 — Archive runtime recovery, persistent visible training timer, explicit soundtrack activation, Commander clip discard, and curated legal reader links
- 2.8.8 — first-party public-domain Archive PDF, E-rank Art of War catalog entry, local reader route and exact PDF page limit
- 2.9.0 — backend-synchronized Daily Command Brief, seven-day non-repeating class/adaptive rotation, live credit reminder, and proof-type preservation for library directives
- 2.9.1 — curated public-domain Mage Archive: every active catalog slot opens in THE SYSTEM reader, outside-record handoffs removed, and existing reading progress preserved in place
- 2.9.2 — native paginated public-domain Archive reader: replaces nonexistent provider-PDF guesses with verified full text rendered inside THE SYSTEM
- 2.9.3 — class workflow stability: server-verified class specials, class-compatible training, cloud auth recovery and progression display repair
- 2.9.4 — Player Foundation Scan: player-chosen class, personalised Fuel direction, routine-aware starting plan and secure cloud persistence
- 2.9.5 — Launch stability: split heavy screens, clear login and six-step foundation scan, backend-confirmed onboarding, 31 bundled book texts, protected quest RPCs, private error codes and live AI planning context.
- 2.9.6 — Login and foundation class-art rotation, multiple improvement goals with one main priority, required weight and feet/inches height input with canonical backend storage.
- 2.9.7 — Automatic login rotation without a pause button, decoded artwork before switching and smoother fades for artwork, tint and captions.

Do not accidentally remove fixes introduced by later versions.

In particular, 2.4 MUST preserve:
- the 2.3.1 XP bar visibility fix
- the 2.3.2 System Intelligence pinned X-button fix

---

# 2. CORE FILES

Primary source files currently include:

```text
src/App.jsx
src/SystemGame.jsx
src/AuthScreen.jsx
src/LoginScreen.jsx
src/MageArchive.jsx
src/SystemIntelligenceFloat.jsx
src/systemCloud.js
src/systemAI.js
src/systemAwareness.js
src/systemExternal.js
src/systemWorkoutTimer.js
```

Important rules:

### `App.jsx`
Authentication, cloud boot and the root recovery boundary. The original full game is preserved in `SystemGame.jsx`; Archive, AI and Class Special load independently. Do not replace these modules with a simplified app. The Training view stays mounted when hidden so timers and GPS continue during navigation.

### `systemCloud.js`
Cloud/backend client integration.

Do not casually change backend contracts here.

### `systemAI.js`
Adaptive Intelligence engine.

This engine is advisory.

It may:
- analyze player behavior
- score recommendations
- detect strengths/weaknesses
- recommend quests
- suggest difficulty
- generate training paths
- forecast progression
- produce alerts

It must NOT:
- award XP
- complete quests
- apply penalties
- fake backend success
- bypass proof
- mutate authoritative progression directly

### `systemAwareness.js`
System Awareness layer.

It handles things such as:
- global active-time tracking
- Daily System Briefing
- local trend memory
- activity history
- recovery recommendations
- Ascension-readiness telemetry
- shared awareness context for System Intelligence

Do not turn local Awareness data into authoritative progression.

---

# 3. BACKEND AUTHORITY

Supabase is the source of truth for progression.

The frontend must not become authoritative for:

- XP awards
- quest completion
- penalties
- level changes
- authoritative timers
- rewards that affect progression
- boss completion
- official Archive progression
- official class progression

Local storage may be used for:

- UI state
- presentation preferences
- temporary forms
- cache
- non-authoritative analytics
- System Awareness memory
- imported-reader state where appropriate

Never award progression because a local UI says something happened.

---

# 4. SUPABASE PROJECT

Known Supabase project:

```text
ref: ojiwavxndprqsdhbnlqy
region: eu-west-1
```

Known Edge Functions:

```text
system-api
system-intelligence-responder
```

Do not expose:
- secrets
- OAuth client secrets
- service-role keys
- private credentials

Never ask the user to paste secrets into chat if another safer method exists.

---

# 5. AUTHENTICATION

Supported auth:

- email/password login
- email/password signup
- Google OAuth

Google OAuth currently uses Supabase Auth.

Do not break:
- existing user identity
- existing profile
- Google account linking
- redirect flow
- session refresh

Development origin:

```text
http://localhost:5174
```

Supabase OAuth callback:

```text
https://ojiwavxndprqsdhbnlqy.supabase.co/auth/v1/callback
```

The app must gracefully handle temporary auth/token timing issues.

For errors such as:

```text
JWT issued at future
```

prefer:
- token refresh
- retry
- degraded sync state

Do not reload the entire game unless absolutely necessary.

---

# 6. PLAYER PROFILE

A player can have:

- name
- gender
- class
- level
- XP
- rank
- streak
- momentum
- attributes
- titles
- achievements
- inventory
- quest history
- boss history
- training progress
- Archive progress
- journey history

Gender options:

```text
MALE
FEMALE
```

Gender is primarily presentation/identity.

Do not create unfair gameplay differences based on gender.

---

# 7. CLASS SYSTEM

Primary classes:

## RANGER

Theme:
- green
- emerald
- movement
- nature-tech
- endurance
- adaptability

Music:

```text
/music/ranger.mp3
```

## MAGE

Theme:
- purple
- arcane
- cosmic
- knowledge
- intelligence
- focus
- learning
- research
- deep work

Music:

```text
/music/mage.mp3
```

## ASSASSIN

Theme:
- red
- dark crimson
- sharp
- fast
- focused
- precise

Music:

```text
/music/assassin.mp3
```

## TANK

Theme:
- bronze
- brown
- stone
- heavy
- durable
- resilient

Music:

```text
/music/tank.mp3
```

## COMMANDER

Theme:
- gold
- amber
- elite
- regal
- strategic
- authoritative

Music:

```text
/music/commander.mp3
```

Class identity must affect:
- visual theme
- training path
- recommendations
- class quests
- exclusive systems when applicable

Do not mix class-exclusive content carelessly.

---

# 8. RANKS AND LEVELS

Ranks:

```text
E = Levels 1–10
D = Levels 11–25
C = Levels 26–40
B = Levels 41–60
A = Levels 61–80
S = Levels 81–100
```

Level 101:

```text
ASCENSION
```

Level 101 is not just another S-rank level.

It represents a major transformation.

Do not reveal every Ascension condition unless explicitly requested.

Progression should become increasingly difficult, especially after Level 50.

Never replace the app's actual XP curve with a generic formula.

If forecasting levels in analytics, use the real `xpRequired()` logic or an approved adapter.

---

# 9. ATTRIBUTES

Core attributes:

```text
STRENGTH
SPEED
ENDURANCE
INTELLIGENCE
FOCUS
DISCIPLINE
WEALTH
CHARISMA
CREATIVITY
RECOVERY
```

Attribute rewards should be related to real actions.

Examples:

Workout:
- STRENGTH
- ENDURANCE

Running:
- SPEED
- ENDURANCE

Reading:
- INTELLIGENCE
- FOCUS

Deep work:
- FOCUS
- DISCIPLINE

Saving/investing:
- WEALTH
- DISCIPLINE

Public speaking:
- CHARISMA

Creative work:
- CREATIVITY

Sleep/recovery:
- RECOVERY

Do not randomly reward unrelated attributes.

---

# 10. QUEST SYSTEM

Quest types include:

```text
DAILY
NORMAL
HARD
ELITE
MUST
CLASS
SURPRISE
BOSS
```

Quest data may include:

- title
- objective
- description
- category
- difficulty
- XP
- attribute reward
- timer
- penalty
- proof requirement
- completion state
- backend ID
- assigned date
- accepted timestamp
- expiry timestamp

---

# 11. MUST QUEST SAFETY

Must Quests are authoritative directives.

They may:
- require acceptance
- have a backend-confirmed timer
- carry a penalty
- require proof

They must NOT:
- duplicate
- loop after completion
- create multiple active records for the same slot/day
- penalize a quest that was replaced or retired

Important concept:

One active quest per logical Must slot/day.

Examples:

```text
2026-08-31-discipline
2026-08-31-focus
2026-08-31-physical
```

If a new directive replaces an older directive in the same slot:
- retire the old record safely
- do not fail it
- do not apply a later stale penalty

Quest acceptance/completion must remain idempotent.

React Strict Mode must not produce duplicate authoritative records.

---

# 12. QUEST DATE SAFETY

Do not mix browser-local dates and UTC dates carelessly.

Avoid blindly using:

```js
new Date().toISOString().slice(0, 10)
```

for local assigned-day semantics.

Frontend and backend must agree on the assigned date.

Pass explicit assigned dates when needed.

---

# 13. QUEST TIMER SAFETY

Timer states may include:

```text
SYNCING
ACTIVE
EXPIRED
COMPLETED
FAILED
SYNC ERROR
```

Do not leave permanent:

```text
INITIALIZING
```

If backend timer setup fails:
- show retry
- do not fake an authoritative timer
- do not enable unsafe completion

---

# 14. PENALTIES

Penalty logic is backend-authoritative.

Example:

```text
REWARD +65 XP
FAILURE -25 XP
```

Never subtract XP purely in React.

A quest that was:
- replaced
- retired
- class-incompatible
- safely declined

must not later receive a stale expiry penalty.

Penalty processing must be idempotent.

---

# 15. PROOF ENGINE

Important quests must not complete from a simple button press.

Supported proof concepts include:

```text
PERFORMANCE
RESULT
LEARNING
PHOTO
REFLECTION
HONOR
```

Safe completion flow:

1. player enters proof
2. player submits
3. backend validates/completes
4. backend confirms success
5. UI closes proof modal
6. UI shows result

If backend rejects:
- keep the modal open
- preserve user input
- show a clear in-app error
- never fake XP

Avoid generic browser `alert()` for important errors.

---

# 16. BOSS QUESTS

Boss Quests represent major real-life goals.

Examples:
- major work project
- endurance challenge
- savings goal
- certification/course
- major career goal

Boss UI should feel more serious than normal quests.

Boss victories may unlock:
- XP
- trophies
- rare rewards
- titles

Backend remains authoritative.

---

# 17. SURPRISE QUESTS

Surprise Quests should feel rare and context-aware.

Possible triggers:
- inactivity
- streak condition
- player weakness
- time of day
- opportunity
- location
- unusual progression state

Do not spam Surprise Quests.

---

# 18. TRAINING SYSTEM

Training is not the same as Quests.

Quests:
- tasks/missions

Training:
- repeated skill development

Each class should have a distinct training identity.

Do not make Mage training mostly physical.
Do not make Tank training primarily academic.
Preserve class identity.

---

# 19. MAGE TRAINING

Mage curriculum:

```text
THE ARCANE MIND
```

Core focuses:
- Knowledge
- Memory
- Focus
- Research
- Deep Work
- Analysis
- Teaching
- Applied Intelligence

Suggested mastery progression:

```text
E — Study Foundation
D — Memory + Deep Work
C — Analysis
B — Synthesis
A — Teach + Research
S — Subject Mastery
```

Mage should feel intellectually powerful.

---

# 20. GRAND ARCHIVE

The Grand Archive is Mage-exclusive.

Do not expose the Archive as a normal global reading feature.

Backend should reject non-Mage progression where applicable.

The Archive contains real books and a separate Knowledge Rank.

Knowledge Rank:

```text
E
D
C
B
A
S
```

One book may be active at a time.

Selecting another should pause, not erase, the previous progress.

Track:
- current page
- progress
- reading minutes
- sessions
- notes
- reflection
- completion

---

# 21. GRAND ARCHIVE VISUAL DESIGN

The Archive should feel like a magical library.

Books should look like:
- collectible grimoires
- real book covers
- visible spines
- page edges
- rank-specific materials
- shelf-based presentation
- dimensional objects, not flat generic cards

The Active Book should feel more important than catalog books.

Completed books should look like trophy volumes.

Do not regress the Archive to a simple card grid.

---

# 22. GRAND ARCHIVE READER

2.2.2 introduced an in-app reader.

The user may import a PDF copy of a book they own.

Important copyright rule:
- do not bundle full copyrighted commercial book text without permission
- public-domain works may be included appropriately
- user-owned files may be imported for personal reading

The reader should support active reading-time tracking.

Reader activity should pause when the player is idle.

---

# 23. SYSTEM AI / ADAPTIVE INTELLIGENCE

2.3 introduced Adaptive Intelligence.

It is a deterministic analysis/recommendation layer.

Core systems:

1. Player Profile Analysis
2. Quest Recommendation Scoring
3. Adaptive Difficulty
4. Personalized Training Paths
5. Level Forecasting
6. Class-Specific Recommendations
7. Smart Alerts
8. Shared analytics cache

This is not allowed to become an alternative progression authority.

The recommendation engine can say:

```text
FOCUS BLOCK
92% MATCH
Targets current weakness: FOCUS
```

It cannot award the XP.

---

# 24. SYSTEM AWARENESS — 2.4

2.4 adds behavior awareness.

Main features:

## Global Active Time

Track active time across the app.

Count time only when:
- app is visible
- player is active

Pause after roughly:
- 2 minutes idle

Activity may include:
- pointer movement
- clicking
- keyboard input
- scrolling
- touch

Display concepts:

```text
ACTIVE TODAY: 01H 42M
COUNTING
PAUSED
```

This active time is advisory/analytics data.

It is not authoritative progression.

---

## Daily System Briefing

When enough data exists, the app may produce a concise briefing.

Example:

```text
GOOD EVENING, ZAID.

2 MUST QUESTS REMAIN.
RECOVERY IS CURRENTLY YOUR LOWEST ATTRIBUTE.
FOCUS HAS DECLINED ACROSS RECENT ACTIVE DAYS.
MAGE TRAINING RECOMMENDED.

SYSTEM ONLINE.
```

Keep the System voice:
- concise
- calm
- authoritative
- not cheesy
- not overly motivational

---

## Trend Memory

2.4 stores compact daily snapshots.

It may detect:
- improving attributes
- declining attributes
- inactivity patterns
- consistency patterns
- multi-day weakness changes

Current Awareness history is device-local unless a backend migration is intentionally introduced.

Do not claim cross-device persistence unless implemented.

---

## 14-Day Activity Memory

The System page may display activity across recent days.

It may combine:
- tracked active time
- quest activity
- workout activity
- history events

Do not fabricate old active-time seconds for dates before tracking existed.

---

## Recovery Directives

After genuine signs of:
- low activity
- lost streak
- low momentum

the System may recommend a smaller comeback directive.

Recovery directives are advisory unless promoted through the real Quest backend.

Do not award XP directly from a recovery suggestion.

---

## Ascension Telemetry

2.4 may track hidden readiness signals.

Do not expose all official Ascension requirements.

Telemetry should communicate readiness without spoiling the final unlock.

---

# 24A. API CORE — 2.5

2.5 adds the secure external intelligence/content layer.

Architecture:

```text
React app
  -> authenticated Supabase Edge Functions
      -> OpenAI Responses API
      -> YouTube Data API
      -> Google Books API / Embedded Viewer
      -> Open Library Search API / Internet Archive reader
```

Frontend API adapter:

```text
src/systemExternal.js
```

Protected Edge Functions:

```text
system-intelligence-responder
system-content-api
```

Required project secrets:

```text
OPENAI_API_KEY
YOUTUBE_API_KEY
GOOGLE_BOOKS_API_KEY
```

Optional model override:

```text
OPENAI_MODEL=gpt-5.6-terra
```

Never place provider API keys in React, Vite client environment variables, source control, or browser storage. Keys belong in Supabase Edge Function Secrets.

System Intelligence is cloud-AI-first when the OpenAI key is configured, while the existing on-device/built-in guidance remains a fallback.

The AI may call content tools to find tutorials and books. It still MUST NOT award XP, complete quests, apply penalties, unlock ranks, or mutate authoritative progression.

Tutorial searches must return embeddable YouTube videos and render them inside THE SYSTEM when possible. Do not replace this with links that force the player to leave the app.

Grand Archive online reading first checks Open Library / Internet Archive for a confirmed publicly readable edition and opens that reader inside the app when available. It also keeps Google Books previews as a source. Borrow-only and catalog-only Open Library records must show a direct provider link rather than a fake full reader. Do not bypass publisher restrictions. User-owned PDFs remain a fallback.


# 24B. FOUNDATION HARDENING — 2.5.1

2.5.1 is a stabilization release, not a gameplay redesign.

It preserves 2.5 behavior while adding:
- root-level runtime error containment
- CSS extracted to `src/styles/system.css`
- testable pure API request builders in `systemExternalCore.js`
- client API timeout and short-lived content caches
- Edge Function timeout handling and best-effort per-user rate limiting
- server-side content response caches
- Node built-in tests for deterministic intelligence and external API contracts
- architecture / Edge Function / async-safety documentation

Do not re-inline the extracted global CSS into `App.jsx`.
Do not remove the tests when refactoring components.
The next structural refactor should split components gradually with tests expanded before each move.

# 25. SYSTEM INTELLIGENCE UI

The floating System Intelligence window and the full SYSTEM page should feel like one brain.

They should share relevant player analysis.

The floating Intelligence window must retain the 2.3.2 close-button hotfix.

The close button:
- must always be visible
- must remain pinned top-right
- must work on desktop
- must work on mobile
- must call the correct close state

Do not remove or visually clip the X.

---

# 26. DASHBOARD XP BAR

The XP bar must retain the 2.3.1 visibility fix.

Do not reduce it back to an almost invisible thin line.

It should have:
- visible track
- readable XP numbers
- class-color fill
- appropriate glow
- sufficient contrast

If redesigning the Dashboard, verify XP visibility manually.

---

# 27. INVENTORY

Inventory should feel collectible.

Example items:

```text
RUNNER'S EDGE
SCHOLAR'S TOME
IRON KEY
FOCUS CRYSTAL
```

Rarities may include:

```text
COMMON
UNCOMMON
RARE
EPIC
LEGENDARY
MYTHIC
```

Typical rarity styling:

```text
RARE       blue
EPIC       purple
LEGENDARY  gold
MYTHIC     red
```

Do not reduce Inventory to a plain list.

---

# 28. REAL-LIFE REWARDS

Rewards should be relevant to the accomplishment.

Example:

A major endurance achievement may suggest:
- recovery gear
- electrolytes
- running accessory
- massage
- training equipment

Avoid unrelated random rewards.

---

# 29. TROPHY ROOM

Trophy Room represents major achievements.

Possible trophies:
- Boss wins
- major streaks
- rare titles
- records
- Ascension-related events

Trophies should feel premium.

---

# 30. TITLES AND ACHIEVEMENTS

Titles may include:

```text
FIRST BLOOD
SCHOLAR
EARLY RISER
```

Achievements should have:
- name
- description
- unlock condition
- rarity
- date
- emblem

Examples:
- FIRST QUEST
- 7-DAY STREAK
- FIRST BOSS
- FIRST BOOK
- 10 BOOKS
- FIRST S-RANK BOOK
- LEVEL 50
- LEVEL 100

---

# 31. JOURNEY

Journey is the chronological story of the player.

Possible events:

```text
QUEST CLEARED
QUEST FAILED
LEVEL UP
CLASS CHANGE
BOOK COMPLETED
BOSS DEFEATED
ITEM ACQUIRED
ACHIEVEMENT UNLOCKED
TITLE EARNED
ASCENSION EVENT
```

The Journey should feel like a record of becoming.

---

# 32. VISUAL LANGUAGE

Core style:

- dark futuristic RPG
- premium glass UI
- collectible 3D cards
- controlled glow
- class-specific atmosphere
- strong readability

Fonts may include:
- Rajdhani
- Share Tech Mono

Base palette:
- deep black
- purple-black
- class accent colors

Do not overuse transparency.

Readability outranks visual decoration.

---

# 33. CARD DESIGN

Cards should generally have:

- dark solid core
- controlled glass effect
- colored edge
- subtle glow
- inner highlight
- depth
- hover lift
- rarity/class/category identity

Important Quest card hierarchy:

```text
CATEGORY • TYPE

QUEST TITLE

OBJECTIVE

REWARD

FAILURE

TIME REMAINING

PROOF REQUIREMENT

STATUS
```

Reward:
- green

Penalty:
- red

Timer:
- clearly separated

Critical text should not be low opacity.

---

# 34. VISIBILITY RULE

Avoid critical UI text at:

```text
opacity: 0.3
opacity: 0.4
opacity: 0.5
```

Recommended hierarchy:

- main titles: 95–100%
- objectives: 80–95%
- metadata: 60–75%
- decorative text: 40–60%

Background artwork must not overpower content.

---

# 35. AUDIO

Preserve existing music:

```text
/music/ranger.mp3
/music/mage.mp3
/music/assassin.mp3
/music/tank.mp3
/music/commander.mp3
```

Existing SFX:

```text
/sfx/click.wav
/sfx/success.wav
/sfx/impact.wav
/sfx/levelup.wav
```

Do not replace with:
- retro GameBoy sounds
- cheap square-wave bleeps
- generic arcade noises

Desired sound:
- cinematic
- dark
- premium
- modern RPG

---

# 36. PERFORMANCE

The application is large.

Avoid:
- unnecessary global rerenders
- repeated backend bootstrap calls
- duplicate effects
- repeated heavy analysis
- expensive stacked shadows everywhere
- overusing backdrop-filter on mobile

Prefer:
- memoization where justified
- deduped requests
- cached analytics
- targeted refreshes
- short animations
- GPU-friendly transforms

Do not use performance optimization as an excuse to remove major features.

---

# 37. REACT SAFETY

Protect against:
- Strict Mode double effects
- rapid double clicks
- duplicate accept calls
- duplicate completion calls
- repeated loading requests

Use:
- single-flight guards
- idempotency
- backend uniqueness
- disabled pending states

Do not rely only on frontend state to prevent duplicate progression.

---

# 38. CLASS CHANGE SAFETY

When player class changes:

- retire incompatible active Class/Must quests
- do not fail them
- do not penalize them
- generate appropriate new directives

Suggested retirement reason:

```text
CLASS_CHANGED
```

Do not leave old Commander quests active for a Mage, etc.

---

# 39. ERROR UX

Prefer in-app System notices.

Example:

```text
SYSTEM NOTICE

QUEST SYNC FAILED

The server could not verify this directive.

[ RETRY ]
```

Do not use generic browser alerts for important production errors.

Preserve:
- proof input
- form state
- imported data
where safe after recoverable failures.

---

# 40. MOBILE SAFETY

Every UI change must be checked for narrow screens.

Especially verify:

- System Intelligence close X
- navigation
- Quest cards
- Archive books
- reader controls
- System Awareness
- Adaptive Intelligence
- modals
- XP bar
- timers

Avoid hover-only functionality.

Touch targets should remain usable.

---

# 41. CODE CHANGE PROCEDURE FOR CODEX

Before editing:

1. inspect the current files
2. identify the current build label
3. confirm 2.3.1 and 2.3.2 hotfixes are present
4. understand the specific user request
5. identify affected components/functions
6. avoid unrelated rewrites

During editing:

1. make the smallest safe change
2. preserve backend contracts
3. preserve all imports
4. avoid renaming authoritative functions without reason
5. avoid deleting old systems just because they are complex
6. preserve user-visible behavior unless explicitly changing it

After editing:

1. run syntax check
2. run Vite build if practical
3. run lint if configured
4. search for missing imports
5. search for duplicate component names
6. search for accidental demo/hardcoded data
7. verify version string if version bump requested
8. verify hotfix preservation
9. summarize exact changed files

---

# 42. VALIDATION COMMANDS

Typical project commands:

```bash
cd /Users/bwoy/the-system
npm run dev -- --port 5174
```

If available:

```bash
npm run build
```

If lint exists:

```bash
npm run lint
```

Do not assume scripts exist.
Inspect `package.json` first.

---

# 43. VERSIONING RULES

For small bug fixes:

```text
2.4.1
2.4.2
```

For meaningful feature additions:

```text
2.5
2.6
```

Do not bump versions automatically unless requested or clearly appropriate.

When creating a stable baseline:
- copy exact source files
- record hashes
- create a manifest
- never overwrite an older baseline archive

---

# 44. DEMO CODE RULE

Any file containing hardcoded sample data such as:

```js
LEVEL 47
6200 / 10000 XP
VOID RUNNER
MENTAL FORTRESS
```

should be treated as a design/reference prototype unless explicitly verified as production.

Never replace authoritative player state with demo constants.

---

# 45. AI / RECOMMENDATION SAFETY

Adaptive Intelligence should use real player data.

It may calculate:

- strengths
- weaknesses
- consistency
- activity
- preferred categories
- recommendation score
- difficulty fit
- forecast
- trend

It must clearly distinguish:
- analysis
- recommendation
- authoritative progression

Never silently turn an AI recommendation into a completed quest.

---

# 46. SYSTEM VOICE

Preferred language examples:

```text
SYSTEM ONLINE
PLAYER IDENTIFIED
QUEST ASSIGNED
MUST QUEST
QUEST CLEARED
PROOF ACCEPTED
ATTRIBUTE INCREASED
ITEM ACQUIRED
ACHIEVEMENT UNLOCKED
BOSS DEFEATED
LEVEL UP
CLASS MASTERY
KNOWLEDGE RANK
GRAND ARCHIVE
ASCENSION
SYSTEM NOTICE
ADAPTIVE INTELLIGENCE
SYSTEM AWARENESS
```

Keep the voice concise.

Avoid excessive fantasy prose.

---

# 47. PRODUCT PHILOSOPHY

The player should feel:

> I am not checking tasks off.
> I am building a character.
> The character is me.

Core philosophy:

```text
Training builds the body.
Quests build discipline.
Bosses build ambition.
The Grand Archive builds the mind.
Inventory represents rewards.
Journey records transformation.
Level 101 represents Ascension.
```

---

# 48. FINAL EXPERIENCE TARGET

When someone opens THE SYSTEM, they should immediately understand:

This is not another productivity tracker.

This is a progression engine for real life.

The app should create the feeling that:

**THE SYSTEM has appeared in the player's life, and from that moment forward their progress is being recorded.**

Final identity:

```text
THE SYSTEM
REAL LIFE / RPG

BUILD YOURSELF.
ONE QUEST.
ONE DAY.
ONE LEVEL AT A TIME.

SYSTEM ONLINE.
```

---

# 49. ABSOLUTE DO-NOT-BREAK CHECKLIST

Before declaring a task complete, confirm the change did NOT break:

- Supabase auth
- Google OAuth
- player profile loading
- XP display
- XP calculation
- Rank logic
- Quest loading
- Must Quest timers
- Must Quest uniqueness
- Quest proof
- Quest penalties
- class changes
- Training
- Boss Quests
- Inventory
- Achievements
- Titles
- Journey
- Grand Archive
- Archive reader
- reading activity tracking
- Adaptive Intelligence
- System Awareness
- System Intelligence
- System Intelligence X button
- Dashboard XP visibility
- class music
- SFX
- mobile layout
- Level 101 / Ascension presentation

If the requested change touches one of these systems, test that system directly.

---

# 50. CODING ATTITUDE

Prefer:
- surgical edits
- explicit state flow
- defensive logic
- readable helper functions
- idempotent backend behavior
- real user data
- graceful degradation
- preserving mature systems

Avoid:
- giant unnecessary rewrites
- speculative architecture changes
- fake backend success
- hardcoded demo data
- deleting complex logic because it is inconvenient
- replacing production files with prototypes
- changing unrelated systems without permission

When uncertain:
inspect the current code first.

The current repository is the truth.

SYSTEM ONLINE.
