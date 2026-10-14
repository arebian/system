# THE SYSTEM 2.9.3 — Class workflow stability

Built on the 2.9.2 native Archive reader. The matching Supabase backend has already been updated for project `ojiwavxndprqsdhbnlqy`.

1. Download `THE_SYSTEM_2_9_3_CLASS_STABILITY.zip` into Downloads.
2. Stop the old app terminal with **Ctrl+C**.
3. Paste this entire command into Terminal:

```bash
system_patch_dir="$(mktemp -d /tmp/the-system-2.9.3.XXXXXX)" && unzip -q /Users/bwoy/Downloads/THE_SYSTEM_2_9_3_CLASS_STABILITY.zip -d "$system_patch_dir" && bash "$system_patch_dir/install-update.sh" /Users/bwoy/the-system
```

Open **http://localhost:5174**. Confirm the header shows **2.9.3**. If a browser tab still shows an older version, press **Cmd+Shift+R** once.

The installer backs up your app beside the project, preserves your environment files, installs the locked dependencies, runs tests and a production build, then starts the app on port 5174. It refuses to overwrite a newer release. If port 5174 is occupied, stop the old server with Ctrl+C and run `npm run dev -- --port 5174 --strictPort` inside `/Users/bwoy/the-system`.

## What to check

| Class | Check |
| --- | --- |
| Commander | Record 30–60 seconds, discard and retake once, add a review, then save. Expect +35 XP and +1 Charisma. |
| Tank | Start Iron Ledger. Enter an exercise, three sets with reps/load, and a form note. Expect +45 XP and +1 Strength. |
| Assassin | Start Silent Target. The 25-minute countdown should be visible and resume after reopening the page. Add the finished result at zero. Expect +40 XP and +1 Focus. |
| Ranger | Start Trail Marker, allow location in Training, move for at least 20 minutes and 200 metres, then finish tracking. Return to Class Special, refresh route status and claim +40 XP and +1 Endurance. |
| Mage | Open Class Special → Grand Archive, open a grimoire and read inside the app. Its existing reading progression is preserved. |

Commander, Tank, Assassin and Ranger share one special reward per account per UTC day (reset: 00:00 UTC / 03:00 in Kenya). Switching classes does not award it again. Mage keeps the separate Archive rules.

Also check that Training shows workouts for your class, the XP bar matches the real level requirement, and changing class refreshes the Daily Command. Completing ordinary quests still uses the existing attribute-credit system.

Camera/GPS permissions depend on your browser and device. Commander practice checks a saved recording and session duration; eye contact is self-reviewed, not automatically scored. Tank's sets are self-reported, not a camera assessment of form.

If you need to restore the old frontend, stop the dev server and copy back the backup folder printed by the installer. Do not clear your character cache or delete your cloud profile.
