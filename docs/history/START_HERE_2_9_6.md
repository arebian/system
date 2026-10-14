# THE SYSTEM 2.9.6 — Class atmosphere and Foundation goals

This is the complete 2.9.5 app with the requested login and onboarding improvements. It preserves the existing quests, classes, Archive, timers, credits, progression, audio, and all 2.9.5 backend fixes.

## Install

Download `THE_SYSTEM_2_9_6_LOGIN_FOUNDATION_UPDATE.zip` into Downloads. Stop the development server with Control+C, then paste:

```bash
cd "$HOME/Downloads" &&
unzip -q -o THE_SYSTEM_2_9_6_LOGIN_FOUNDATION_UPDATE.zip -d THE_SYSTEM_2_9_6_UPDATE &&
bash THE_SYSTEM_2_9_6_UPDATE/the-system-2.9.6/install-update.sh /Users/bwoy/the-system
```

The installer makes a dated backup, preserves environment configuration and Git history, refuses a downgrade, installs locked dependencies, runs tests/build, and starts the app at http://localhost:5174. Install the full package: the app uses several screen modules.

## Requested changes

- Login and Foundation now show the actual Commander, Tank, Ranger, Mage and crimson Assassin artwork. The classes cycle slowly, with a smooth fade and a quiet revolving ring. The form stays opaque and readable.
- Pause/resume is available. Rotation stops in a hidden tab and when reduced motion is enabled. Only the current and outgoing image layers are rendered; the next image is loaded before switching.
- Improvement goals support multiple selections. The first selection is the main priority. Removing it promotes the next remaining goal; removing a selected goal does not clear the others.
- Supporting goals influence class suggestions and are stored with the main goal. Experience and class stay single selections. The player still chooses the class and final Fuel direction.
- Weight in kg is required to continue. Height uses separate feet/inches inputs, with range checks and automatic conversion to the existing centimetre storage format. Height remains optional.
- A failed save preserves the chosen goals, measurements, class and Fuel choice for retry.

## Backend deployed

Migration `20261013124955_foundation_multiple_goals` is applied to project `ojiwavxndprqsdhbnlqy`. It updates the existing authenticated Foundation save RPC to validate and preserve multiple goals, require weight, accept decimal measurements, keep legacy single-goal requests compatible, and retain the player's chosen class and progression.

Existing player profiles are not reset or given new XP. Earlier profiles can still be read; the new weight requirement applies when saving a Foundation scan. The 2.9.5 content and AI functions remain at version 8 with JWT verification.

## Verification

- 77 Node tests pass, including multi-goal normalization, feet/inches conversion, class suggestions, complete bundled books, timer authority and credit limits.
- Production build and installer syntax checks pass.
- All five artwork transitions, pause/resume, reduced motion, preserved login inputs and error recovery pass at 1440 px and 390 px.
- Foundation layout checks pass at both sizes. Mobile completion tests confirm required weight, invalid-inch rejection, multiple goals, manual class choice, and save failure/retry.
- 41 live transactional database checks pass: 21 for the new goal/measurement rules, 7 for the existing Foundation contract, and 13 for security/error-reporting. Synthetic test data is rolled back.
- Live provider/endpoint check results are in `docs/validation/live-endpoint-report.json`. These checks do not authenticate a real Google account or call paid AI.

## Remaining launch checks

The backend is healthy, but these checks still need the account/device used to run the app:

1. Google: sign in, finish the Foundation scan, reload and confirm the saved class and goals return. The callback should return to your running app at http://localhost:5174.
2. AI: ask “How can I level up from here?” and confirm a cloud AI reply using the real account. If it stays in guidance mode, check the `OPENAI_API_KEY` Edge Function secret in the Supabase dashboard. Keep the key out of browser code and chat.
3. Commander: record using the real camera, discard a clip, upload a new clip and delete it. Ranger: grant GPS permission, complete a linked route, then test denied-permission recovery. Confirm each completion is rewarded once.
4. Training: complete a genuine countdown, refresh and confirm its completion/reward stays consistent.
5. Mage: open a book, change pages, save a genuine reading session and reopen it. Already loaded text remains available during disconnection; save when connected again.

Leaked-password protection is still disabled. The project is on Supabase's Free plan, and the built-in feature is [available on Pro and above](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No subscription change was made. If you enable the feature on a supported plan, use the [project's Email provider settings](https://supabase.com/dashboard/project/ojiwavxndprqsdhbnlqy/auth/providers), set the server minimum password length to at least 8, and retest signup.

Real camera/GPS, full OAuth and paid AI are not proven by mocked browser tests. This patch is ready to install and review; those launch checks remain open.
