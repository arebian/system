# THE SYSTEM 2.8.1 — AI, Archive + Fuel Repair

Built on the stable 2.8.0 Living System update.

## Fixed

- System Intelligence status now checks `OPENAI_API_KEY`, the same server-only
  secret used by `system-intelligence-responder`.
- The Intelligence panel shows a clear setup/retry state instead of silently
  presenting a generic response as if it were cloud AI.
- Built-in guidance now answers common Planche, Fuel and Archive questions
  specifically while the cloud connection is unavailable.
- Archive search now prefers a credible, legally embeddable Google Books
  edition before falling back to a metadata-only edition.
- The reader now offers **SEARCH ANOTHER EDITION** before the owned-PDF
  fallback.
- Fuel now presents a class-and-goal daily meal sequence and lets the player
  prefill a meal-log entry from it. It asks only for CUT, MAINTAIN or BULK;
  the class remains the existing player class.

## Live backend deployed

- `system-api` version 9 — accurate OpenAI/Google Books configuration status.
- `system-intelligence-responder` version 5 — safe cloud-failure signals and
  more useful built-in guidance.

## One owner action still required for real AI

Add a valid `OPENAI_API_KEY` in Supabase **Edge Functions → Secrets**. This
key must stay server-side. The app cannot create or recover an OpenAI key for
the project. Open the Intelligence panel and use **CHECK CONNECTION** after
adding it.

## Reader limitation

Google Books can only be embedded when the provider marks an edition as
embeddable in the player's region. THE SYSTEM will not bypass publisher access
rules. For a title without a legal preview, use the existing owned-PDF reader.
