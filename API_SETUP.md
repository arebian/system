# THE SYSTEM — API SETUP

## What is already done

The Supabase backend functions have already been deployed to the production project:

- `system-intelligence-responder` — ACTIVE
- `system-content-api` — ACTIVE (version 8, current reader/Open Library resolver and protected native Archive text route)
- `system-api` — ACTIVE (version 9; source included in this repository)
- JWT verification remains enabled on all three functions
- the 2.8.4 Adaptive directive repair is live
- the 2.8.5 class-attribute, credit-ledger, and allocation hardening migrations are live
- the 2.8.6 timer-verification backend is live
- the 2.8.7 Archive legal-reader and Archive RPC permission migrations are live
- the 2.8.8 embedded public-domain Archive migration is live
- the 2.9.0 Daily Command and seven-day quest-rotation migration is live
- the 2.9.1 curated in-app Archive catalog migration is live
- the 2.9.2 native Archive text reader route is live

The frontend build is wired to those authenticated functions through `src/systemExternal.js`.

## Production backend status

The production project already has this patch. Do **not** reset browser storage,
delete profiles, or manually edit attributes. Existing earned attributes remain
untouched; only unchanged legacy all-10 placeholder rows are calibrated to their
existing class baseline.

## 2.9.2 Native in-app Grand Archive reader

Project Gutenberg does not publish an equivalent PDF for every public-domain
title. THE SYSTEM therefore never guesses a `-images.pdf` URL. **The Art of
War** remains the locally served, 111-page public-domain PDF; every other
curated Archive title is fetched as verified Project Gutenberg full text by the
authenticated `system-content-api` function, then paginated and rendered inside
the focused reader.

The browser can request only a catalog reader key. The Edge Function maps that
key to an allowlisted Project Gutenberg eBook number, checks response size and
timeouts, and keeps a small server-side cache. It does not accept arbitrary
provider URLs. The native reader continues to keep page progress, engaged time
and notes in THE SYSTEM. **SOURCE & LICENSE** remains available only for
checking the original source.

## 2.9.1 Curated in-app Grand Archive

Every active Mage Archive book resolves to a curated public-domain edition
inside THE SYSTEM's focused reader. Choosing a book never opens an Open Library
record, Google Books page, borrow page, or a new browser tab. The reader keeps
the current page, engaged time and notes in the app. A small **SOURCE &
LICENSE** link remains only for checking the original source.

The catalog update changes the existing Mage catalog rows in place. That keeps
each player's assigned book record and its reading progress attached while the
commercial/outside-link metadata is replaced with the matching curated edition.

## 2.9.0 Daily Command and quest rotation

The Dashboard now reads a small **Daily Command Brief** from Supabase. It shows
the player's actual accepted Must Quest, the same class directive that appears
in Quests, and the live total of unspent attribute credits. It is advisory:
reading it never accepts a Must Quest, awards XP, spends credits, or changes
progression.

The authoritative rotation now keeps one Daily directive and one class
directive per day. Class and Adaptive directive selection excludes an identical
recent directive for seven days whenever another compatible option exists.
The backend also serializes generation per player/day, so two devices cannot
produce two class directives for the same day.

## 2.8.8 Archive and stability behavior

- The timer popup belongs only to Training. Closing it keeps the server timer
  alive and displays a visible **LIVE COUNTDOWN** card; press it to reopen the
  focused countdown window.
- The Grand Archive no longer references Training state, so opening Archive
  cannot crash with `activeTimer is not defined`.
- Commander recordings have **× DISCARD CLIP & RETAKE**. It only removes the
  unsubmitted browser clip; already submitted private proof is never deleted.
- Class music starts only after the player uses the **Class Soundtrack** toggle.
  SFX clicks cannot start background music.
- Every active Archive slot has a curated Project Gutenberg edition which opens
  directly in the focused reader. The reader has no provider-record fallback or
  external-tab handoff. The owned-PDF import remains available only for a
  player's own lawful file.
- **The Art of War** remains a separate E-rank title with a complete, locally
  served 111-page public-domain PDF. It opens instantly inside THE SYSTEM;
  other curated editions render as fixed native public-domain text pages in the
  same reader.

If this package is deliberately installed against a different Supabase project,
apply the included migrations and deploy the authenticated content function:

```bash
npx supabase@latest db push --project-ref ojiwavxndprqsdhbnlqy
npx supabase@latest functions deploy system-content-api --project-ref ojiwavxndprqsdhbnlqy --use-api
```

The migrations add compatible generic Physical Standard directives, the protected
Adaptive resolver, class-specific attribute baselines, and a server-owned quest
credit ledger. The content-function upgrade uses Internet Archive metadata only
to enhance already-confirmed public Open Library editions with an in-app PDF
reader.

If the 2.8.2 System Intelligence responder has not already been deployed, run
this once as well:

```bash
npx supabase@latest functions deploy system-intelligence-responder --project-ref ojiwavxndprqsdhbnlqy --use-api
```

## What you still need to do once

Provider credentials must be stored as **Supabase Edge Function secrets**, never in `App.jsx`, `systemExternal.js`, Vite client variables, Git, or browser storage.

In Supabase Dashboard, open your project, go to **Edge Functions -> Secrets**, and add:

```text
OPENAI_API_KEY=<your OpenAI API key>
OPENAI_MODEL=gpt-5.6-terra
YOUTUBE_API_KEY=<restricted Google Cloud API key with YouTube Data API v3 enabled>
GOOGLE_BOOKS_API_KEY=<restricted Google Cloud API key with Books API enabled>
```

`OPENAI_MODEL` is optional because the Edge Function already defaults to `gpt-5.6-terra`.

You do **not** need to redeploy the functions after adding the secrets; hosted Supabase Edge Functions can read updated project secrets immediately.

## OpenAI

Create an API key from the OpenAI Platform and add it only as `OPENAI_API_KEY` in Supabase secrets.

THE SYSTEM calls the OpenAI **Responses API** from the server-side Edge Function. The browser never receives the key.

System Intelligence can:

- reason over the player's current System context
- interpret attributes, streak, momentum, active Boss information and Awareness context
- explain training and quests
- choose internal tools for tutorial search and book search
- return resources that THE SYSTEM renders inline

System Intelligence still cannot:

- award XP
- complete quests
- apply penalties
- grant Boss damage
- unlock ranks
- bypass proof

Supabase remains authoritative.

## If System Intelligence repeats a generic reply

That means THE SYSTEM is using limited built-in guidance rather than the cloud
model. The panel now shows **AI CORE // SETUP REQUIRED** when the server cannot
see `OPENAI_API_KEY`.

1. Open the Supabase project → **Edge Functions** → **Secrets**.
2. Add `OPENAI_API_KEY` with a valid OpenAI Platform key. Keep it out of the
   browser and source code.
3. Optionally set `OPENAI_MODEL=gpt-5.6-terra`.
4. Return to the in-app Intelligence panel and press **CHECK CONNECTION**.

No Edge Function redeploy is needed after changing a hosted Supabase secret. If
the panel reports an auth, rate-limit or response failure instead, check the
project’s OpenAI billing/model access and then retry the connection.

## YouTube tutorials

Enable **YouTube Data API v3** in a Google Cloud project and create a restricted API key.

Store it in Supabase as:

```text
YOUTUBE_API_KEY
```

The content function requests only video results that are marked embeddable/syndicated. The app renders them using the privacy-enhanced `youtube-nocookie.com` player.

Example inside System Intelligence:

```text
PLAYER: show me a pull-up tutorial
```

THE SYSTEM can return playable tutorial cards directly inside the Intelligence panel. The player does not need to open YouTube search in another tab.

## Grand Archive / Google Books + Open Library

Enable the **Google Books API** and create a restricted API key.

Store it in Supabase as:

```text
GOOGLE_BOOKS_API_KEY
```

When a Mage opens the active Grand Archive book:

1. A bundled public-domain title opens the locally embedded THE SYSTEM PDF
   immediately; no provider lookup is needed.
2. For all other titles, THE SYSTEM securely resolves Google Books and Open Library by title/author.
3. It prefers a close matching publicly readable Open Library / Internet Archive
   edition, then an embeddable Google Books edition.
4. When Open Library confirms a public Internet Archive identifier, the app
   first opens the legal provider reader and upgrades to a native PDF surface
   only when that public item exposes a PDF in Internet Archive metadata.
5. When Open Library only exposes a lending or catalog record, the app shows a
   verified direct provider button instead of claiming the whole book is free.
6. If neither provider has legal in-app access, THE SYSTEM keeps the existing
   **Import Owned PDF** path.

The direct provider URL is resolved on demand and cached briefly by the secure
content API; it does not alter authoritative Archive progress, XP, or rank.
This does not bypass copyright or publisher restrictions. Commercial books may
expose a preview, lending page, or metadata record rather than a full copy.

## Fuel System

Fuel asks only for **CUT**, **MAINTAIN** or **BULK**. It already knows the
player’s class and must not ask for it again. The selected goal now produces a
class-specific daily meal sequence. **PREPARE LOG** copies a suggested meal
name and slot into the calorie/protein log; the player enters the actual values
from their own portion.

## Timer-verified training

Core Foundation and other stationary timed training use a focused countdown,
not GPS. The backend owns the start time and target duration, so closing the
timer or refreshing the browser never resets it. The training claim only
unlocks when the backend clock reaches zero.

GPS remains reserved for actual outdoor movement workouts such as running,
walking, cycling, hiking, and swimming.

## 2.6 Archive recovery and Commander video proof

THE SYSTEM 2.6 keeps the live Grand Archive API and adds a visible local
recovery shelf if the catalog RPC is slow, empty or unavailable. The recovery
shelf never awards official XP or Knowledge Rank; those remain server-owned.

Commander Command Presence recordings use the existing authenticated `proofs`
Storage bucket. The client uploads a short private video, registers it as proof
and then submits an existing Commander communication/charisma Training skill
attempt when the cloud catalog contains one. The client never modifies
Charisma or XP directly.

Keep the `proofs` bucket's existing authenticated upload policy intact. Do not
make the bucket public just to support recordings.

## 2.8.5 attribute credits

Completing a quest with the normal verified proof receipt can create one to three
attribute credits, subject to the backend's per-day cap. The browser cannot award,
choose an ineligible stat, overspend, or reuse a credit. The player chooses from
the eligible attributes shown by the server in **Attributes → Attribute Credit
Console**. The allocation is written atomically with an audit event.

Class alignment is guidance, not a cap: a Mage can build Strength, but fresh Mage
profiles start knowledge-first rather than with the old flat all-10 values.

## Frontend development setup

Follow [the Git workflow](docs/COLLABORATING.md). From your checkout root, run `npm ci`, configure `.env.local` for your development backend, then `npm run dev -- --port 5174`. Use branches and pull requests instead of copying ZIP packages into the project. See [backend recovery](docs/BACKEND_RECOVERY.md) before creating or linking a database.

## Quick test checklist

After provider secrets are configured:

1. Open System Intelligence and ask: `What should I focus on today?`
   - status should change to `ONLINE // OPENAI API CORE` after a successful AI response.

2. Ask: `show me a pull-up tutorial`
   - tutorial cards should appear inside the Intelligence conversation.
   - pressing `PLAY HERE` should replace the thumbnail with the embedded video player.

3. As Mage, choose any Archive book and press `READ NOW`.
   - it should open the focused reader inside THE SYSTEM, without `LOCATING A READABLE EDITION...`, an Open Library record or a new browser tab.
   - the reader should open as a centered no-scroll modal.
   - the header should show `THE SYSTEM NATIVE PUBLIC-DOMAIN READER` (or the bundled Art of War PDF), and the page arrows should use the reader's smooth page transition.
   - active reading time pauses after roughly two minutes idle or when the app tab is hidden.
   - use `SOURCE & LICENSE` only to inspect the original source; reading stays inside THE SYSTEM.

4. Complete a real quest with its normal verified proof receipt.
   - XP/proof/completion still go through the authoritative backend.
   - a clear **ATTRIBUTE CREDIT EARNED** card should appear when the quest is eligible.
   - open **Attributes → Attribute Credit Console**, choose one displayed eligible stat, and confirm it changes once.
   - refreshing the app must not duplicate the credit or the allocation.

5. Open Quests and wait for **ADAPTIVE DIRECTIVE**.
   - it should show a compatible Standard directive, never another class's Must Quest.
   - `SUBMIT PROOF` should open the normal proof window before completion.

## Security

Never send API keys through chat and never paste them into `App.jsx`.

Official documentation used for this architecture:

- OpenAI developer quickstart / Responses API: https://platform.openai.com/docs/quickstart
- OpenAI models: https://platform.openai.com/docs/models
- Supabase Edge Function secrets: https://supabase.com/docs/guides/functions/secrets
- YouTube Data API search: https://developers.google.com/youtube/v3/docs/search/list
- Google Books API: https://developers.google.com/books/docs/v1/using
- Google Books Embedded Viewer: https://developers.google.com/books/docs/viewer/developers_guide
- Open Library Search API: https://openlibrary.org/dev/docs/api/search
- Open Library Read API: https://openlibrary.org/dev/docs/api/read


## 2.5.1 hardening behavior

The API layer now includes additional resilience:

- browser-to-Edge requests fail fast instead of hanging indefinitely
- System Intelligence client timeout: ~30 seconds
- content client timeout: ~15 seconds
- Google Books and YouTube results are cached briefly in the browser session
- the content Edge Function also keeps short-lived in-memory response caches
- OpenAI calls abort after ~30 seconds
- content upstream calls abort after ~12 seconds
- authenticated per-user best-effort rate limits are applied in Edge Function isolates

Current best-effort limits:

- System Intelligence: 12 requests / minute / user / isolate
- tutorial search: 30 requests / minute / user / isolate
- book search: 30 requests / minute / user / isolate
- book lookup: 60 requests / minute / user / isolate

These in-memory limits are a first abuse-control layer, not a globally distributed billing-grade limiter. If the app grows to a large public user base, move rate accounting into a shared store or database-backed limiter.
