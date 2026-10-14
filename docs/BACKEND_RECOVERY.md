# Rebuilding the backend

Recovered on 2026-10-14 from project `ojiwavxndprqsdhbnlqy` using read-only connected tools. No live schema, functions, accounts or migration history were changed.

## What is versioned

- `supabase/functions/system-api/index.ts`: deployed version 9, including authenticated progression routes and action receipts.
- Existing `system-content-api` and `system-intelligence-responder` sources.
- `supabase/config.toml`: local development configuration, PostgreSQL 17 and JWT verification for all three functions. It is not an export of production auth/provider settings.
- `supabase/migrations/20261014153429_recovered_backend_baseline.sql`: a rebuild baseline containing the original `profiles` schema, all 74 deployed migrations in their original order, and the two inventory RPCs that were missing from recorded migration history.
- [Original migration SQL](history/backend-migrations/): preserved separately with the exact deployed timestamps/names and statements. These files are historical records; the CLI runs only the baseline under `supabase/migrations`.

The baseline contains catalog seeds, functions, tables, indexes, policies and storage bucket declarations. It contains no auth accounts, player records, uploaded clips or API secrets. Private bucket files must be backed up separately if moving a live service.

## Fresh local development

Install the Supabase CLI and run Docker Desktop. From the repository root:

```bash
supabase start
supabase status
```

The CLI applies the baseline to the fresh local database. Copy its API URL and public client key to `.env.local`; never copy the service-role key into Vite variables. Function-only provider secrets go in an ignored backend env file. Serve the functions locally with `supabase functions serve`. Configure OAuth separately if testing Google login.

To rebuild an existing disposable local database, `supabase db reset --local` erases its local data and reapplies the baseline. Never use a linked production reset for development.

## Existing live project: stop before db push

The live project still has its original 74 migration records. The recovered baseline is a new, squashed history for fresh databases. Do **not** run `supabase db push` or blindly mark the baseline applied against that project: its migration ledger has not been reconciled. The baseline deliberately refuses to execute when `public.profiles` already exists.

Before future production database releases, the backend owner must compare a schema-only pull/dump of the live project with a fresh reset, audit any manual schema drift, back up the database, and reconcile migration history using the CLI's documented repair/squash workflow. Check the installed CLI's `--help` before these operations. This is a separate release step; ordinary Git pulls never change the live database.

Future code changes use `supabase migration new descriptive_name`, tests on a disposable database, and a reviewed PR. Deploy functions only to the intended development project until a production release is approved.

## Verification limits

The full baseline was replayed in a disposable PostgreSQL-compatible PGlite database with minimal Supabase auth/storage scaffolding. This verifies SQL execution and dependency order. Compared with the live catalog, all 54 tables, 657 column definitions, 80 RPC signatures and function bodies, 103 policies, and 286 pre-existing constraints match. RLS settings match on every table. PGlite exposes additional NOT NULL constraint records, while the corresponding column nullability matches the live project. It does not exercise the Docker Supabase stack, Google OAuth, Edge Function runtime or real player actions. Run those integration checks before a production backend release.
