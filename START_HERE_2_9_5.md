# THE SYSTEM 2.9.5 — Launch stability

This update starts from the complete 2.9.4 Player Foundation Scan build. It preserves quests, skill trees, class specials, Fuel, Inventory, Journey, trophies, authoritative timers and attribute-credit allocation.

## Install on your Mac

Download `THE_SYSTEM_2_9_5_LAUNCH_STABILITY.zip` into Downloads. Stop the running development server with Control+C, then paste:

```bash
cd "$HOME/Downloads" &&
unzip -q -o THE_SYSTEM_2_9_5_LAUNCH_STABILITY.zip -d THE_SYSTEM_2_9_5_UPDATE &&
bash THE_SYSTEM_2_9_5_UPDATE/the-system-2.9.5/install-update.sh /Users/bwoy/the-system
```

The installer backs up the current app, preserves your environment configuration and Git history, rejects downgrades, installs the locked dependencies, runs the tests and build, then serves the app at http://localhost:5174. If this ZIP is extracted elsewhere, run its `install-update.sh` with your project directory as the argument.

## What changed

| Requested improvement | Status in this patch |
| --- | --- |
| Close anonymous quest endpoints | Deployed: PUBLIC/anon execution removed from both title-based quest RPCs; authenticated execution retained. |
| Leaked-password protection | Still needs the dashboard setting described below. It is not enabled by a database migration. |
| Real-account checks | Database authority and browser workflows checked. Physical camera/GPS, real Google OAuth and paid AI replies still need the checklist below. |
| Recovery messages | Auth deadlines, section-level retry/reload, AI connection feedback, preserved onboarding answers and reporting added. Existing GPS permission and proof retry handling retained. |
| Dead book sources | All 31 curated editions bundled. Protected source resolver tries three known URLs for the same edition and rejects HTML error pages. |
| Heavy screens | Archive, AI and Class Special load separately. AI waits until first open. Training remains mounted during navigation; stable callbacks avoid unrelated Awareness renders. |
| Theme and scrolling | Immediate palette updates, no card backdrop blur, fewer mobile shadows, stable launcher and dark startup background. |
| Loading states | Screen-specific loading UI preserves the app navigation. |
| Server progression | Existing authoritative XP, timers, streaks and credits preserved; class duplicate-reward, ownership and timer guards tested against the live database. |
| Error tracking | Deployed authenticated, rate-limited RPC for private error codes, screen and build. No message text, chat, proof, GPS route, clip, URL or stack is transmitted. |
| Daily Command Brief | Three actions: Must directive, class action, Fuel/recovery. Credit allocation stays visible. Zero streak is preserved and the command refreshes when the day or progression changes. |
| AI context | Live class, attributes, unfinished quests, XP, streak and Boss state retained. Fuel totals, routine, recovery and available credits added. The model remains guidance-only. |
| Archive reading | Full texts open as native paginated pages inside the existing modal. The Art of War PDF remains included. Imported owned PDFs remain supported. |
| Personal onboarding | Clearer login plus Identity → Foundation → Routine → Fuel → Class → Brief. Class suggestions and final class choice remain separate. Backend save finishes before entry. |
| Class attributes | Existing class baselines and player choice of eligible attribute credits preserved and regression tested. |

## Backend already deployed

Project: `ojiwavxndprqsdhbnlqy`.

- Migration `20261009130901_launch_stability_security_and_observability` is applied.
- `system-content-api` version 8 is deployed with JWT verification.
- `system-intelligence-responder` version 8 is deployed with JWT verification.
- Live checks confirm anonymous quest access is denied and raw error events are inaccessible to client roles.
- Reading ownership policies use cached auth identity lookups; missing book foreign-key indexes were added.
- Transactional backend tests use synthetic accounts and roll back. No test accounts remain.

No SQL copy/paste or backend redeployment is required for this project's patch installation.

## Checks completed

- 74 Node tests pass, including reader validation, credential redaction, 24-hour windows, class attributes, credit limits and network retry safety.
- Production Vite build passes with every JavaScript chunk under 500 kB. The game bundle is about 246 kB, with Archive/AI/Class Special split out; the prior single app bundle was about 614 kB. This is a bundle-size result, not a measured device-speed claim.
- Five class-special workflows pass on desktop and all five mobile light layouts pass with no horizontal overflow. Camera and GPS are simulated in these browser tests.
- Mobile onboarding save failure/retry preserves the manually chosen class and Fuel direction.
- 90 live PostgreSQL checks pass: class-special authority (70), foundation persistence (7), new permissions/telemetry ownership/rate limits (13).
- 31 complete bundled book texts match their SHA-256 manifest. Original source and license notices are retained.
- Login layout and error recovery checked at 1440 px and 390 px. Full-app navigation, AI opening and native book page turns are covered by the browser runner.

Run the local suite with `npm test` and `npm run build`. Browser runners in `tests/browser` additionally need Playwright and Chromium; they use test fixtures rather than a real player's account.

## Remaining launch checks

1. Open [Supabase Auth settings](https://supabase.com/dashboard/project/ojiwavxndprqsdhbnlqy/auth/providers), select Email, and enable leaked-password protection if available on your plan. Set a server-side minimum password length of at least 8. Save and retest signup. [Supabase documents availability on Pro and above](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). The connected tools cannot edit this Auth setting; it remains disabled in the live advisor result.
2. Use a real account: Google sign-in and return to saved progress; ask AI “How do I level up from here?” and check that its status says cloud AI when the connection is ready. If not connected, configure `OPENAI_API_KEY` in Edge Function secrets using the dashboard, never in the browser. The existing `OPENAI_MODEL` setting is preserved.
3. Commander: record on the real device, discard a clip, upload another, and delete it. Confirm one reward only. Ranger: grant GPS permission, complete a real linked route, and retry once with denied permission. Complete a full training countdown and refresh to confirm the server accepts it once.
4. Mage: open a book, turn pages, close, reopen and save a genuine reading session. Disconnect the internet while reading an already loaded edition; the text should remain, while saving waits for a connection. Bundling avoids outside-provider dependency; this patch does not add a service worker or guarantee a first offline app launch.

This is ready to install and review. Public launch still depends on the real-account/device checks and Auth setting above.

## Book provenance

`public/books/text/manifest.json` records each source URL, edition number, byte count and hash. The full files retain their Project Gutenberg notices. The collection consists of editions listed as public domain in the United States; consult each source for local rights. The app does not distribute the replaced commercial titles under their old slot names; stable internal keys are retained only to preserve existing reading progress.
