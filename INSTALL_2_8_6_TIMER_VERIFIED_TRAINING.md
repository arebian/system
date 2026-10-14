# Install THE SYSTEM 2.8.6

The backend is already deployed. This command updates only your local frontend,
preserves `.env`, `.env.local`, `node_modules`, and player data, creates a
backup, then tests, builds, and starts the app.

Paste this exact line into Terminal after downloading the zip to `~/Downloads`:

```bash
cd /Users/bwoy && cp -R the-system "the-system-backup-$(date +%Y%m%d-%H%M%S)" && patch_dir="$(mktemp -d /tmp/the-system-2.8.6.XXXXXX)" && unzip -q ~/Downloads/THE_SYSTEM_2_8_6_TIMER_VERIFIED_TRAINING.zip -d "$patch_dir" && rsync -a --exclude='.env' --exclude='.env.local' --exclude='node_modules' --exclude='dist' "$patch_dir/" /Users/bwoy/the-system/ && cd /Users/bwoy/the-system && npm install && npm test && npm run build && npm run dev -- --port 5174
```

Do not use **RESET LOCAL CHARACTER CACHE** for this update.

## Quick check

1. Open **Training → Core Foundation**.
2. It must say **TIMER VERIFIED**, not **GPS VERIFIED**.
3. Press **START FOCUS TIMER**. The page behind it must not scroll.
4. Confirm the 20-minute session countdown and set/rest timer appear.
5. Close it, then press **RESUME COUNTDOWN**. The remaining time must continue
   rather than restart.
6. Open Runner Base or 5K Builder and confirm GPS remains available there.

