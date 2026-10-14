# Install THE SYSTEM 2.8.3

This in-place update preserves the current app, player data, `.env` files,
`node_modules`, and `dist` until the new build passes. It creates a dated
backup before copying the patch.

```bash
cd /Users/bwoy
cp -R the-system "the-system-backup-$(date +%Y%m%d-%H%M%S)"
patch_dir="$(mktemp -d /tmp/the-system-2.8.3.XXXXXX)"
unzip -q ~/Downloads/THE_SYSTEM_2_8_3_OPEN_LIBRARY_READER.zip -d "$patch_dir"
rsync -a --exclude='.env' --exclude='.env.local' --exclude='node_modules' --exclude='dist' "$patch_dir/" the-system/
cd the-system
npm install
npm test
npm run build
npx supabase@latest login
npx supabase@latest functions deploy system-content-api --project-ref ojiwavxndprqsdhbnlqy --use-api
npx supabase@latest functions deploy system-intelligence-responder --project-ref ojiwavxndprqsdhbnlqy --use-api
npm run dev -- --port 5174
```

Then open `http://localhost:5174`, confirm the header reads **2.8.3**, switch
to a Mage profile, open **Grand Archive**, and press **READ NOW** on an active
book. A public edition opens in the reader; otherwise the app offers the
verified provider page or the existing owned-PDF path.

No Open Library secret is needed. The second Edge Function deploy keeps the
latest 2.8.2 System Intelligence source live as well.
