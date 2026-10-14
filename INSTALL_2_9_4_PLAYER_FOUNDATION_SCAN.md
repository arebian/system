# THE SYSTEM 2.9.4 — Player Foundation Scan

Built from the stable 2.9.3 class-workflow release. The matching Supabase backend has already been updated for project `ojiwavxndprqsdhbnlqy`.

1. Download `THE_SYSTEM_2_9_4_PLAYER_FOUNDATION_SCAN.zip` to Downloads.
2. Stop the old app terminal with **Ctrl+C**.
3. Paste this exact command into Terminal:

```bash
system_patch_dir="$(mktemp -d /tmp/the-system-2.9.4.XXXXXX)" && unzip -q /Users/bwoy/Downloads/THE_SYSTEM_2_9_4_PLAYER_FOUNDATION_SCAN.zip -d "$system_patch_dir" && bash "$system_patch_dir/install-update.sh" /Users/bwoy/the-system
```

Open **http://localhost:5174** and confirm the header says **2.9.4**. If Chrome keeps an older bundle, press **Cmd+Shift+R** once.

## What changed at first login

After account sign-in, a new player completes a five-step Foundation Scan:

1. Identity: name, age and voice preference.
2. Foundation: first goal, experience, and optional weight/height.
3. Routine: activity, available time, meals, obstacles, food preferences, food budget and training access.
4. Class: the System shows three possible fits, but does **not** select one. The player always chooses their class.
5. Brief: the System suggests Cut, Maintain or Bulk; the player confirms the final Fuel direction and sees a practical first-week plan.

Weight and height are optional. They only provide starting calorie/protein estimates; they do not change class, XP, attributes, quest rules or progression. The player can choose Cut, Maintain or Bulk even when it differs from the recommendation.

The installer creates a dated backup beside the app, preserves `.env` files, installs locked dependencies, runs tests and a production build, then starts the local app. It refuses to overwrite a newer version.

## Quick check

- Create a test account or use a new account.
- Complete every Foundation Scan step.
- Confirm no class is preselected on the class screen.
- Choose a class and a Fuel direction different from the suggestion if desired.
- Finish setup, refresh the app, and confirm the selected class and Fuel goal persist.

If you need to restore the old frontend, stop the dev server and copy the backup folder printed by the installer back into `/Users/bwoy/the-system`. Do not clear character cache or delete a cloud profile.
