# THE SYSTEM — Foundation Security Audit

**Branch:** `foundation/security-audit`  
**Audit date:** 2026-11-19  
**Scope:** dependency state, Supabase RLS, RPC authorization, storage access, quest progression integrity, and AI context boundaries.

## Applied database hardening

The following migrations have been applied to the connected Supabase project and are committed on this branch:

- `20261119154936_lock_player_event_writes.sql` — removed client insert/update policies from `progression_events` and `journey_events`; revoked direct client execution of the pillar-cement trigger function.
- `20261119155125_index_objective_task_fk.sql` — added the missing index for `user_quest_objectives.task_id`.
- `20261119155432_guard_legacy_daily_quest_duplicates.sql` — added a partial unique index for legacy quests without a catalog ID, keyed by player, assigned date, and normalized title.
- `20261119162454_safe_player_character_reset.sql` — added an authenticated, user-scoped reset RPC that deletes all player-owned rows in `public` and `system_private`, then removes the profile while preserving the Supabase Auth account.
- `20261119162732_proof_video_upload_support.sql` — aligned the private proof bucket with the app's 35 MiB upload limit and supported image/video MIME types.

The event tables remain readable and deletable by their owner. Canonical history writes are performed by trusted backend functions.

## Authorization findings

- All tables in the `public`, `storage`, and `system_private` schemas have RLS enabled.
- Every RLS policy found on a `public` table containing `user_id` uses `auth.uid()` in its ownership condition.
- The `system_private` schema is not usable by `anon` or `authenticated`.
- No public-schema SECURITY DEFINER function is executable by `anon`.
- Of 88 public SECURITY DEFINER functions, 81 are callable by `authenticated`. All 81 were reviewed: 80 explicitly bind to `auth.uid()`; `system_assign_boss()` delegates to `system_weekly_boss_status_v1()`, which enforces the authenticated user context.
- All public SECURITY DEFINER functions have a configured search path.
- Internal progression helpers `system_award_xp()` and `system_add_attribute()` are not executable by client roles.
- The pillar cement trigger function is not executable by client roles.

Supabase's 81-function SECURITY DEFINER warning remains because these are intentional user-facing RPCs that need elevated table access while enforcing their own user boundary. It is not being suppressed by blanket permission changes.

The character-reset action in `system-api` removes the player's private objects from both storage buckets using the service role, then calls the user-bound reset RPC. The frontend clears the matching local awareness, celebration and System Intelligence state only after the server confirms success. The reset integration test verifies the Auth session survives and a second player's data remains untouched.

## Storage

Both `proofs` and `class-special-clips` buckets are private.

- Proof objects are scoped to the authenticated user's UUID path. The private `proofs` bucket accepts JPEG, PNG, WebP, MP4, WebM and QuickTime files up to 35 MiB; the frontend picker and uploader enforce the same MIME allowlist.
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

The System Intelligence endpoint previously accepted arbitrary browser awareness and guidance text into its model prompt. The new shared context normalizer keeps only bounded numeric values and allowlisted enums (class, rank, attributes, and fuel goal). Free-text browser briefing, recovery, boss and directive labels are excluded. Unit tests cover prompt-injection strings and malformed values.

## Automated validation

A GitHub Actions workflow runs:

1. `npm audit --audit-level=high`
2. Full Node test suite
3. Multi-objective quest browser flow
4. Living System browser workflows
5. Responsive sign-in and registration browser tests
6. Production build
7. Isolated local Supabase migration reset and authenticated integration tests, including cross-user profile isolation, private proof storage, and direct history-write rejection.

The run at commit `85d4255` passed all three jobs, including the expanded two-user history and storage integration tests. The newer AI-context hardening run is being revalidated after a parser test caught and fixed a regex escaping error.

## Remaining follow-up

- Investigate two recent `503 REVIEW_UNAVAILABLE` responses from the quest-review path. Existing request logs do not contain the upstream provider response, so the cause is not yet established.
- Enable Supabase Auth leaked-password protection in the hosted project. The live security advisor currently reports it disabled.
- Review production Supabase Auth settings separately from the repository's local-development `config.toml`; local settings do not prove the hosted project's password, confirmation, or MFA configuration.
- Keep the Supabase advisor's no-policy notices for `client_error_events` and `system_private.review_rate_limits` under review. Both currently have no client access by design.
- Do not drop the advisor's unused indexes solely from low usage counts; verify query workload before any removal.

No player progression rows were deleted or reset during this audit.
