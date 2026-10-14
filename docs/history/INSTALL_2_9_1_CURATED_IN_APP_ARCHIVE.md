# Install THE SYSTEM 2.9.1 — Curated In-App Grand Archive

This patch is based on the stable 2.9.0 Daily Command + Quest Rotation build.
It keeps local environment files, dependencies and built output out of the
copy, then runs the app's test and production build before starting Vite.

From Terminal, after downloading `THE_SYSTEM_2_9_1_CURATED_IN_APP_ARCHIVE.zip`
to `~/Downloads`, run exactly:

```bash
cd /Users/bwoy && cp -R the-system "the-system-backup-$(date +%Y%m%d-%H%M%S)" && patch_dir="$(mktemp -d /tmp/the-system-2.9.1.XXXXXX)" && unzip -q ~/Downloads/THE_SYSTEM_2_9_1_CURATED_IN_APP_ARCHIVE.zip -d "$patch_dir" && rsync -a --exclude='.env' --exclude='.env.local' --exclude='node_modules' --exclude='dist' "$patch_dir/" /Users/bwoy/the-system/ && cd /Users/bwoy/the-system && npm install && npm test && npm run build && npm run dev -- --port 5174
```

Then open `http://localhost:5174`, enter **Grand Archive**, and press **READ
NOW** on any book. It should open the reader in the app, with no provider page
or new tab.

The matching Supabase migration is already applied to the production project.
If this source is intentionally used with another Supabase project, apply
`supabase/migrations/20260921163847_archive_curated_in_app_editions.sql` and
`supabase/migrations/20260921164151_archive_curated_reader_key_guard.sql`
before deploying the frontend.
