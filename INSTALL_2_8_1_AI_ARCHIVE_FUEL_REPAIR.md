# Install THE SYSTEM 2.8.1

This is an in-place update for `/Users/bwoy/the-system`. It creates a dated
backup and preserves existing `.env`, `.env.local`, `node_modules` and `dist`
until the new build succeeds.

```bash
cd /Users/bwoy
cp -R the-system "the-system-backup-$(date +%Y%m%d-%H%M%S)"
patch_dir="$(mktemp -d /tmp/the-system-2.8.1.XXXXXX)"
unzip -q ~/Downloads/THE_SYSTEM_2_8_1_AI_ARCHIVE_FUEL_REPAIR.zip -d "$patch_dir"
rsync -a --exclude='.env' --exclude='.env.local' --exclude='node_modules' --exclude='dist' "$patch_dir/" the-system/
cd the-system
npm install
npm test
npm run build
npm run dev -- --port 5174
```

Then open `http://localhost:5174` and confirm the header reads **2.8.1**.

## Required one-time live configuration for real AI

In Supabase Dashboard → your project → **Edge Functions** → **Secrets**, set:

```text
OPENAI_API_KEY=<your OpenAI Platform API key>
OPENAI_MODEL=gpt-5.6-terra
```

The model setting is optional. Do not put either value into React, Vite env
files, source code, browser storage or chat. After saving, open System
Intelligence and press **CHECK CONNECTION**.
