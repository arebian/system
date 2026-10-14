# THE SYSTEM 2.9.2 — Native Archive Reader Hotfix

## What this fixes

The Grand Archive no longer relies on guessed Project Gutenberg PDF URLs.
Those URLs caused the provider's 404 page to appear inside THE SYSTEM.

- **The Art of War** remains a locally bundled public-domain PDF.
- Every other curated Archive title now opens as fixed, paginated text inside
  THE SYSTEM.
- The back/next controls turn the native pages with the existing smooth page
  transition.
- The authenticated backend accepts only known Archive reader keys, never an
  arbitrary external URL.

## Install this patch

From macOS Terminal, paste this exact command after downloading the ZIP:

```bash
cd /Users/bwoy && cp -R the-system "the-system-backup-$(date +%Y%m%d-%H%M%S)" && patch_dir="$(mktemp -d /tmp/the-system-2.9.2.XXXXXX)" && unzip -q /Users/bwoy/Downloads/THE_SYSTEM_2_9_2_NATIVE_ARCHIVE_READER_FIX.zip -d "$patch_dir" && rsync -a --exclude='.env' --exclude='.env.local' --exclude='node_modules' --exclude='dist' "$patch_dir/" /Users/bwoy/the-system/ && cd /Users/bwoy/the-system && npm install && npm test && npm run build && npm run dev -- --port 5174
```

Then open `http://localhost:5174`, press **Cmd + Shift + R**, and open an
Archive book such as **How to Live on 24 Hours a Day**. You should see a paper
reading page inside THE SYSTEM, not a Project Gutenberg page or a 404 message.

If this app is intentionally connected to a different Supabase project, deploy
the included `system-content-api` function to that project before testing the
reader. The production project used by this package is already updated.
