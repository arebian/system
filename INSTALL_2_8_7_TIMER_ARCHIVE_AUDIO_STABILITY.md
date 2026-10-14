# Install THE SYSTEM 2.8.7

The backend migrations are already live. This command updates only your local
app, preserves `.env`, `.env.local`, `node_modules`, and `dist`, then verifies
the new build before starting it.

Stop the currently running Vite server with `Ctrl+C`, then paste this exact
command into Terminal:

```bash
cd /Users/bwoy && cp -R the-system "the-system-backup-$(date +%Y%m%d-%H%M%S)" && patch_dir="$(mktemp -d /tmp/the-system-2.8.7.XXXXXX)" && unzip -q ~/Downloads/THE_SYSTEM_2_8_7_TIMER_ARCHIVE_AUDIO_STABILITY.zip -d "$patch_dir" && rsync -a --exclude='.env' --exclude='.env.local' --exclude='node_modules' --exclude='dist' "$patch_dir/" /Users/bwoy/the-system/ && cd /Users/bwoy/the-system && npm install && npm test && npm run build && npm run dev -- --port 5174
```

After the terminal says Vite is ready, open `http://localhost:5174` and hard
refresh once with `Cmd+Shift+R`.

## Quick check

1. Open **Grand Archive**. It should load instead of showing an interface
   failure.
2. Start a stationary workout. The full timer window opens; close it and verify
   the countdown card remains visible in Training.
3. In **Class Special → Commander**, record a short test clip and press
   **× DISCARD CLIP & RETAKE**. It should disappear before any upload.
4. In **System → Sound**, click an SFX control. Music must remain off until you
   explicitly turn on **Class Soundtrack**.
5. As Mage, open a curated Archive title. Use **OPEN LIVE EDITION** to reach
   its legal reader link.
