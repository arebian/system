# Release check — 2.9.3

Validated on 24 September 2026, based on the current 2.9.2 source and live backend contracts.

## Changes

- Replaced placeholder quest redirects with working Tank, Assassin and Ranger class-special flows.
- Replaced Commander's incorrect planning-skill submission with a dedicated Charisma practice receipt. Added a private video bucket, WebM/MP4 recording support, local discard, bounded recording duration and truthful completion messages.
- Added server-owned sessions, expiry, daily reward uniqueness, ownership checks, replay-safe completion and Journey receipts. Direct client writes to reward/session records are denied.
- Restricted displayed workout templates to the current class. The backend already enforced class eligibility; it now also avoids resuming a previous class's incompatible workout timer.
- Daily Command excludes an old class's completed directive after switching class. In-flight reads are scoped to the account, class and date.
- All Supabase REST, function and storage requests now share one bounded JWT recovery path. Network failures, ambiguous writes and business-rule rejections are not automatically retried. A changed account cannot replay a previous account's request.
- AI class recommendations use the same core-attribute definitions as Attributes. Updated the cloud and local class-special guide.
- Corrected the interface's old `100 + level × 50` XP requirement to match the live backend curve. Corrected rank boundaries to E 1–10, D 11–25, C 26–40, B 41–60, A 61–80, S 81–100. Existing earned values were not rewritten.

## Executed checks

| Check | Result |
| --- | --- |
| Node regression suite | 67 tests passed |
| Production Vite build | Passed |
| Scope inspection of edited JavaScript/JSX | No new unresolved identifiers |
| Browser class-special workflows | All 5 classes passed |
| Narrow 390px layouts in light mode | All 5 classes passed; no horizontal overflow |
| Live PostgreSQL regression suite | Passed; covers all 5 classes, invalid/early claims, ownership, RLS, duplicates, cancellation, expiry, class changes, XP/attribute receipts and Archive access |
| Test-data cleanup | Transaction rolled back; zero synthetic test accounts remain |
| Installer | Shell syntax checked; backup/config-preservation and downgrade behavior checked |

Browser automation uses mocked API responses, a simulated camera, and accelerated clocks to exercise UI behavior. Backend tests invoke the real database functions under authenticated roles using isolated synthetic records, rolled back afterward. Video tests use metadata fixtures, not physical camera footage. A real outdoor GPS route, your Mac's camera permissions, and a full Google OAuth round trip still need the short device check in `INSTALL_2_9_3.md`.

## Backend applied

- Migration `20260923153130_class_special_workflows`.
- `class_special_sessions` has RLS and owner-only reads; completion/start/cancel RPCs enforce `auth.uid()` and class ownership.
- Private `class-special-clips` bucket; WebM/MP4 only, 35 MB maximum, owner-restricted paths.
- `system-intelligence-responder` version 7 deployed and ACTIVE with JWT verification.
- `system-api` version 9 and `system-content-api` version 7 remain ACTIVE with JWT verification.
- Current live Archive returned 31 active titles with embedded-reader keys. This patch preserves the native reader from 2.9.2; it does not claim every external source was downloaded again during these class tests.

## Remaining limits

The production app chunk remains about 595 kB before gzip; Vite emits its existing size warning. A later, separate component-splitting pass can improve initial loading.

Supabase advisors still report existing items: two quest RPCs executable by `anon` (their bodies require authentication), leaked-password protection disabled, older RLS performance suggestions and three Archive foreign-key index suggestions. New authenticated class-special RPC warnings are intentional: they are the guarded mutation interface, and owner/cross-owner regression tests passed. This release is not a complete security audit. References: [function permissions](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [password security](https://supabase.com/docs/guides/auth/password-security), [foreign-key indexes](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).

## Reproduce

```bash
npm ci
npm test
npm run build
```

For optional browser regression checks, install Playwright separately without changing the lockfile, then run:

```bash
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium
node tests/browser/workflows.cjs
```

Run `tests/backend-class-specials.sql` as the database owner against the matching project to repeat the transaction-isolated backend checks. The file ends with ROLLBACK.
