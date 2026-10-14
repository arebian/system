# Install THE SYSTEM 2.8.4

Paste this in macOS Terminal after downloading `THE_SYSTEM_2_8_4_READER_MODAL_STABILITY.zip`:

```bash
cd /Users/bwoy
cp -R the-system "the-system-backup-$(date +%Y%m%d-%H%M%S)"
patch_dir="$(mktemp -d /tmp/the-system-2.8.4.XXXXXX)"
unzip -q ~/Downloads/THE_SYSTEM_2_8_4_READER_MODAL_STABILITY.zip -d "$patch_dir"
rsync -a --exclude='.env' --exclude='.env.local' --exclude='node_modules' --exclude='dist' "$patch_dir/" the-system/
cd the-system
npm install
npm test
npm run build
npx supabase@latest db query --project-ref ojiwavxndprqsdhbnlqy --file supabase/migrations/20260913193000_adaptive_directive_repair.sql
npx supabase@latest functions deploy system-content-api --project-ref ojiwavxndprqsdhbnlqy --use-api
npm run dev -- --port 5174
```

This preserves `.env`, `.env.local`, `node_modules`, and `dist`; it also creates a timestamped backup before copying the patch. If Supabase asks you to sign in, run `npx supabase@latest login`, finish the browser sign-in, then repeat the two Supabase lines.
