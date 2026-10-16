# Ordinary quest completion

The mandatory AI approval step and completion-method selector have been removed from ordinary quests. The original proof form is restored. The backend checks the quest's evidence format without calling OpenAI, then issues the usual server-bound receipt before the existing reward transaction. Timer/GPS requirements, attachment ownership, learning takeaways, expiry, single-use receipts and duplicate-reward protection remain enforced. Weekly preparation boss review is separate.

## Player experience

- A backend-confirmed level increase opens a short celebration. Rank changes and Level 101 have a larger reveal; a known active boss becoming complete gets a victory card. Cards show real attribute deltas, respect existing sound settings and reduced motion, support keyboard dismissal, and never award rewards themselves. Initial cloud hydration does not replay old milestones.
- Quest proof is reviewed for meaning, including typos and informal wording. Incomplete or ambiguous evidence gets a focused explanation/question while the original proof stays in the form. The model advises a decision; PostgreSQL validates the receipt and performs the existing XP, streak and attribute-credit transaction. Timer/GPS requirements keep their server-evidence path. Chat cannot approve proof.
- A weekly preparation boss is a concentrated session that produces a finished supply for 5–7 days. The first catalog covers breakfast portions, packed lunches and complete outfits. It scales to 1–4 people, provides quantities, supplies, steps, storage instructions and a concrete finish line. These are authored batch tasks, not arbitrary AI-generated missions. More original categories can be added after product discussion.
- A real Raid Entry Key is still required. Acceptance and completion are idempotent. One assignment per rolling seven days prevents Sunday/Monday farming or timezone changes from resetting the gate. Preparation checkboxes do not award a victory: a final approved result is required. Retiring or expiring a weekly boss has no XP penalty and does not reset its original cooldown. Existing active legacy raids retain their original interface and resolver.

## Files and boundaries

`AchievementCelebration.jsx` and `systemAchievementCore.js` handle presentation. `WeeklyBoss.jsx` and `systemLivingApi.js` handle the new workflow. The existing game and cloud adapter have small integration patches; the original large application remains intact.

`system-api` dispatches the new authenticated actions to `_shared/livingSystem.ts`. It reuses the existing Supabase auth context and `OPENAI_API_KEY` / `OPENAI_MODEL` settings. Provider requests use the Responses API with strict JSON output, a timeout and `store: false`. Only the server objective, minimal proof context and any explicitly submitted image are sent. Video reflection remains self-reviewed; no automated video assessment is claimed. The hourly server limit is 20 review/plan requests per account.

The new migration adds owner-readable, service-written review receipts and plan drafts. A receipt is bound to user, quest, assignment date, objective, class and exact normalized proof. Approved receipts expire after 30 minutes and are consumed in the reward transaction. Browser-supplied timestamps or reward amounts are not trusted. The existing quest reward implementation is moved into a private schema behind this guard. Weekly claims reuse the original boss XP/trophy implementation after validating their output receipt; fixed additional attributes are related to the task.

The `system-intelligence-responder` instructions recognize the saved weekly plan and can explain preparation or substitutions. It cannot change an accepted target or approve completion.

## Equipment and audio

The server grants the existing level-unlocked catalog items and computes active bonuses from owned, equipped catalog entries. Runner’s Edge gives +5 Speed, Iron Key +8 Strength, Focus Crystal +10 Focus, Vanguard Emblem +10 Discipline, and Ascendant Core +15 to each attribute, using the existing required levels. Duplicate copies never stack. The Attributes screen and character power show the effective totals and the gear contribution; earned attributes, XP, quest credit and mastery requirements remain based on real verified actions. Unequipping removes only the loadout bonus. Player-written gear descriptions and boss trophy text cannot mint attributes.

Soundtrack playback now reports playing, paused, blocked and failed states; remembered audio preferences can resume when the browser permits. A deliberate retry handles blocked playback. SFX clicks never start music. Track changes stop the previous class track; switching tabs pauses and resumes the same position. A saved volume of zero stays muted. Assassin light mode uses the existing crimson artwork with a visible, restrained opacity.

## Current recipe limits

The first breakfast recipe uses an oats base and the lunch recipe uses rice, cooked beans and vegetables. This version does **not** infer allergy substitutions: nonempty dietary restrictions block these recipes instead of silently ignoring them. New reviewed recipes are needed to serve those players. Breakfast also offers a ready-to-eat dry pantry option. Fridge-only storage is not presented as sufficient for a whole week of wet meals. Later portions use the freezer; the plan links [USDA leftover guidance](https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/leftovers-and-food-safety). Counts are scaled, but calories, macros and local prices are not invented. A spending limit is recorded and shown for checking against existing supplies; this is not a price-checked shopping service. Active effort estimates exclude drying/chilling time.

## Review and deployment

The release is prepared for the user-approved production rollout. The backend migration, function dispatcher and frontend form a coordinated release. Old frontend clients cannot satisfy the new textual-proof receipt guard, so refresh/version handling must be part of rollout.

1. Review the feature branch and run `npm ci`, `npm test` and `npm run build`.
2. On a fresh disposable local Supabase project, `supabase start` applies the baseline and new migration. Serve functions locally using the existing documented workflow and configure a provider key only in an ignored backend env file.
3. Exercise real email sign-in, typo/partial/full proof, an image submission, unavailable AI, the on-time wake flow, GPS, a complete weekly boss, its replay, retirement and the cooldown.
4. Before any production migration, follow [Backend recovery](BACKEND_RECOVERY.md). The live project's original migration ledger still needs reconciliation; do not apply the fresh-database baseline to it. Deploy only through a separately approved release.

The SQL tests replay the complete migration sequence in disposable PGlite with minimal auth/storage scaffolding and exercise role permissions and reward transactions. They do not replace a full Supabase Docker/Edge runtime check. Provider tests use mocked responses, not paid requests or real player data. They verify the contract and failure behavior, not the judgment quality of a particular live model.

Browser checks use the real components with mocked transport at 390px and 1440px. Run `npm run test:browser:living` with a Playwright browser installed. Use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` if Chromium is provided by your environment. The scenarios cover rank reveal, keyboard dismissal, a clarification, network failure preserving input, double submission, the complete boss flow and horizontal overflow. Screenshots/reports stay under ignored `test-results/`.

## References checked during implementation

- [Supabase authenticated Edge Functions](https://supabase.com/docs/guides/functions/auth-legacy-jwt)
- [Database function privileges](https://supabase.com/docs/guides/database/functions)
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Food handling and storage](https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/leftovers-and-food-safety)

## Release verification — 2026-10-16

99 automated tests passed, including full disposable SQL replay, receipt binding and equipment ownership/level/duplicate/unequip checks. Browser flows passed at 390px and 1440px for achievement reveals, proof recovery, weekly bosses, real MP3 playback and switching, equipping/unequipping and Assassin light mode. Production builds passed. The production schema was compared against the recovered baseline: 54 table definitions, 80 function bodies/signatures, 96 public policies and 286 constraints matched. Production’s additional service-role default function grants were reviewed separately. An application-state and schema rollback copy was saved before release.

The original production migration ledger must be retained; apply only the reviewed delta through the connected migration tool. The fresh-database baseline must never run on production. A full local Docker stack and a real owner Google OAuth round trip are distinct from the automated checks.
# Free self-reported quest completion

Ordinary quest proof windows default to **Self-reported · Free**. The player supplies the quest's required evidence and explicitly confirms completion. The backend loads the real objective, checks eligibility and evidence format, and issues a normal owner-bound, expiring, single-use receipt with `model: SELF_REPORTED` and `snapshot.verification_mode: SELF_REPORTED`. This path never calls an AI provider and does not claim independent verification.

Learning quests still require three distinct takeaways. Photo/video quests still require their original owned attachment. Timer/GPS requirements and weekly preparation boss review cannot be replaced by self-report. Existing reward, XP, daily-credit, expiry and duplicate-completion rules remain in the database transaction. Optional AI review stays available when the provider account has quota.
