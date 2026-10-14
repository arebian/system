# Install THE SYSTEM 2.8.2

This is an in-place hotfix for `/Users/bwoy/the-system`. It creates a dated
backup and preserves existing `.env`, `.env.local`, `node_modules` and `dist`
until the new build succeeds.

```bash
cd /Users/bwoy
cp -R the-system "the-system-backup-$(date +%Y%m%d-%H%M%S)"
patch_dir="$(mktemp -d /tmp/the-system-2.8.2.XXXXXX)"
unzip -q ~/Downloads/THE_SYSTEM_2_8_2_QUEST_AND_AI_HOTFIX.zip -d "$patch_dir"
rsync -a --exclude='.env' --exclude='.env.local' --exclude='node_modules' --exclude='dist' "$patch_dir/" the-system/
cd the-system
npm install
npm test
npm run build
npx supabase@latest login
npx supabase@latest functions deploy system-intelligence-responder --project-ref ojiwavxndprqsdhbnlqy --use-api
npm run dev -- --port 5174
```

Then open `http://localhost:5174`, confirm the header reads **2.8.2**, and
open **Quests**. The Boss Gate should render instead of showing an interface
failure.

## AI note

The deployment makes the broader no-key guidance live. For flexible cloud AI,
set a valid `OPENAI_API_KEY` in Supabase **Edge Functions → Secrets** and then
use **CHECK CONNECTION** inside System Intelligence. Keep that key out of the
browser and source code.
