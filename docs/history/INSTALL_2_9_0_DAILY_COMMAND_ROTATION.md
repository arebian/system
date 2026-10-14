# Install THE SYSTEM 2.9.0

Stop the running Vite server first with `Ctrl+C`, then run this exact command in
Terminal:

```bash
cd /Users/bwoy && cp -R the-system "the-system-backup-$(date +%Y%m%d-%H%M%S)" && patch_dir="$(mktemp -d /tmp/the-system-2.9.0.XXXXXX)" && unzip -q ~/Downloads/THE_SYSTEM_2_9_0_DAILY_COMMAND_ROTATION.zip -d "$patch_dir" && rsync -a --exclude='.env' --exclude='.env.local' --exclude='node_modules' --exclude='dist' "$patch_dir/" /Users/bwoy/the-system/ && cd /Users/bwoy/the-system && npm install && npm test && npm run build && npm run dev -- --port 5174
```

Then open `http://localhost:5174` and press `Cmd+Shift+R` once.

The Supabase migration is already live on the production project, so there is
no additional backend command for this release.
