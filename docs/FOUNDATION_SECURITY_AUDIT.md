# THE SYSTEM — Foundation Security Audit

**Branch:** `foundation/security-audit`  
**Audit date:** 2026-11-19  
**Scope:** dependency state, Supabase RLS, RPC authorization, storage access, quest progression integrity, and AI context boundaries.

## Applied database hardening

The repository keeps a recovered baseline for isolated local resets; the live project retains its full historical migration ledger. The following recent live migration versions are aligned with their committed filenames:

- `20261016154317_living_system_weekly_bosses_and_review.sql` — private review rate limits, review receipts and weekly preparation boss plans.
- `20261116153400_add_multi_objective_quests.sql` — actionable objective library and parent/child quest structure.
- `20261116153406_complete_multi_objective_quests.sql` — prevents parent quest completion before its required objectives are complete.
- `20261116153410_require_ai_review_for_objective_xp.sql` — gates objective completion and XP on a valid, unconsumed AI review.
- `20261116153415_add_objective_timer_verification.sql` — server-authoritative objective timer sessions and duration checks.
- `20261116153458_lock_objective_guard_trigger_execution.sql` — removes direct client execution from the trigger-only parent quest guard.
- `20261118134630_pillar_daily_quest_integrity.sql` — enforces the three-mission pillar quest shape and awards cement once on qualifying completion.
The following migrations have been applied to the connected Supabase project and are committed on this branch:

- `20261119154936_lock_player_event_writes.sql` — removed client insert/update policies from `progression_events` and `journey_events`; revoked direct client execution of the pillar-cement trigger function.
- `20261119155125_index_objective_task_fk.sql` — added the missing index for `user_quest_objectives.task_id`.
- `20261119155432_guard_legacy_daily_quest_duplicates.sql` — added a partial unique index for legacy quests without a catalog ID, keyed by player, assigned date, and normalized title.
- `20261119162454_safe_player_character_reset.sql` — added an authenticated, user-scoped reset RPC that deletes all player-owned rows in `public` and `system_private`, then removes the profile while preserving the Supabase Auth account.
- `20261119162732_proof_video_upload_support.sql` — no-op history marker. A direct SQL bucket update was reverted; future proof-bucket configuration must use the Supabase Storage API.
- `20261119163527_lock_public_table_ddl_and_event_ledgers.sql` — removed `TRUNCATE`, `TRIGGER` and `REFERENCES` from current public tables and future postgres-owned public tables; made progression, journey and boss-damage ledgers read-only to client roles.
- `20261119163623_revoke_public_table_maintain.sql` — removed PostgreSQL `MAINTAIN` from current public tables and future postgres-owned public tables.
- `20261119163930_default_deny_future_public_objects.sql` — changed postgres-owned future public tables and sequences to default-deny for API roles; new migrations must explicitly grant the minimum required access.
- `20261119164007_revoke_default_public_function_execute.sql` — removed PostgreSQL's global default PUBLIC EXECUTE grant for future postgres-owned functions.
- `20261119164749_lock_core_player_state_dml.sql` — revoked direct client writes to canonical profiles, attributes, quests, objectives, reviews, rewards and progression tables; profile deletion is now only through the reset RPC.

The progression, journey and boss-damage ledgers remain readable only under their owner-scoped SELECT policies. Client roles cannot insert, update, delete or truncate them; canonical writes and account-reset deletion run through trusted backend functions. Canonical profiles, attributes, quests, objectives, reviews, rewards, inventory, skills, titles and pillar progress are also read-only to player clients.

## Authorization findings

- All tables in the `public`, `storage`, and `system_private` schemas have RLS enabled.
- Every RLS policy found on a `public` table containing `user_id` uses `auth.uid()` in its ownership condition.
- The `system_private` schema is not usable by `anon` or `authenticated`.
- No public-schema SECURITY DEFINER function is executable by `anon`.
- `anon` and `authenticated` no longer have `TRUNCATE`, `TRIGGER`, `REFERENCES` or `MAINTAIN` privileges on current public tables.
- Future postgres-owned public tables and sequences default to no API-role access. Future postgres-owned functions no longer inherit PUBLIC EXECUTE; new RPCs must explicitly grant only what they require.
- Of 89 public SECURITY DEFINER functions, 82 are callable by `authenticated`. All 82 were reviewed: 81 explicitly bind to `auth.uid()`; `system_assign_boss()` delegates to `system_weekly_boss_status_v1()`, which enforces the authenticated user context. The newly added `system_delete_player_data()` RPC is also bound to the caller through `auth.uid()` and is not executable by `anon`.
- All public SECURITY DEFINER functions have a configured search path.
- Internal progression helpers `system_award_xp()` and `system_add_attribute()` are not executable by client roles.
- The pillar cement trigger function is not executable by client roles.

Supabase's 82-function SECURITY DEFINER warning remains because these are intentional user-facing RPCs that need elevated table access while enforcing their own user boundary. It is not being suppressed by blanket permission changes.

The character-reset action in `system-api` removes the player's private objects from both storage buckets using the service role, then calls the user-bound reset RPC. The frontend clears the matching local awareness, celebration and System Intelligence state only after the server confirms success. The reset integration test verifies the Auth session survives and a second player's data remains untouched.

## Storage

Both `proofs` and `class-special-clips` buckets are private.

- Proof objects are scoped to the authenticated user's UUID path. The live private `proofs` bucket currently accepts JPEG, PNG and WebP files up to 5 MiB. The UI also exposes video proof, but its upload types/35 MiB limit do not match the bucket configuration; this needs a Storage API bucket update before video proof can work reliably.
- Class-special clips require the matching active Commander session and user path.
- The review Edge Function validates the attachment path against the authenticated user before generating a short-lived signed URL.

## Progression integrity scan

Read-only checks against the live database found:

- 732 quest rows; no missing owners or completed quests missing completion timestamps.
- No orphaned objectives.
- No parent quests with more than three objectives.
- No pillar/objective pillar mismatches.
- No completed pillar quests missing the cement-award marker.
- No completed pillar quests with a mission count other than three.
- No completed objectives missing their review reference or with an unconsumed review.
- No duplicate objective XP awards.
- No duplicate pillar cement award events.
- Every stored cement balance matches its cement-award event count.
- No duplicate penalty records.
- XP accounting is split by design: positive awards are recorded in `progression_events`, while expiry deductions are recorded in `quest_penalty_events` and `journey_events`; penalties clamp current XP at zero and are unique per quest.
- No duplicate canonical quest/player/day records.
- No duplicate legacy quest title/player/day records.

An initial broad duplicate scan grouped several legacy rows with a null catalog ID together. Follow-up checks confirmed these were different quest titles on the same day, not duplicate quests; no historical rows were removed.

## AI context boundary

The System Intelligence endpoint previously accepted arbitrary browser awareness and guidance text, plus unfiltered text from server-stored profile, quest and boss rows. The shared context normalizers now keep only bounded numeric values, allowlisted enums, sanitized clock values and aggregate quest counts. Player names, profile notes, quest titles, boss names/metadata, event descriptions, routine metadata and arbitrary profile JSON are excluded from the model prompt. Unit tests cover prompt-injection strings and malformed values from both browser and database-derived context.

## Automated validation

A GitHub Actions workflow runs:

1. `npm audit --audit-level=high`
2. Full Node test suite
3. Multi-objective quest browser flow
4. Living System browser workflows
5. Responsive sign-in and registration browser tests
6. Production build
7. Isolated local Supabase migration reset and authenticated integration tests, including cross-user profile isolation, private proof storage, and direct history-write rejection.

The previously completed run at commit `85d4255` passed all three jobs, including the two-user history and storage integration tests. A newer run is being revalidated after the AI-context hardening and migration-history alignment changes.

## Remaining follow-up

- Investigate two recent `503 REVIEW_UNAVAILABLE` responses from the quest-review path. Existing request logs do not contain the upstream provider response, so the cause is not yet established.
- Enable Supabase Auth leaked-password protection in the hosted project. The live security advisor currently reports it disabled.
- Align the private `proofs` bucket with the app's video-proof workflow using the Supabase Storage API (not direct SQL changes to the `storage` schema).
- Review production Supabase Auth settings separately from the repository's local-development `config.toml`; local settings do not prove the hosted project's password, confirmation, or MFA configuration.
- Keep the Supabase advisor's no-policy notices for `client_error_events` and `system_private.review_rate_limits` under review. Both currently have no client access by design.
- Do not drop the advisor's unused indexes solely from low usage counts; verify query workload before any removal.

No player progression rows were deleted or reset during this audit.
