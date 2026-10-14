# Install THE SYSTEM 2.8.5

The production backend is already deployed. This command updates only your local
frontend source, preserves `.env`, `.env.local`, and player data, makes a backup,
then runs the test/build/start sequence.

Paste this exact block into Terminal after downloading the zip to `~/Downloads`:

```bash
cd /Users/bwoy && cp -R the-system "the-system-backup-$(date +%Y%m%d-%H%M%S)" && patch_dir="$(mktemp -d /tmp/the-system-2.8.5.XXXXXX)" && unzip -q ~/Downloads/THE_SYSTEM_2_8_5_CLASS_ALIGNMENT_STABILITY.zip -d "$patch_dir" && rsync -a --exclude='.env' --exclude='.env.local' --exclude='node_modules' --exclude='dist' "$patch_dir/" /Users/bwoy/the-system/ && cd /Users/bwoy/the-system && npm install && npm test && npm run build && npm run dev -- --port 5174
```

Expected result: the tests and build finish without errors, then the app opens at
`http://localhost:5174`. Do not use **RESET LOCAL CHARACTER CACHE** for this
update.

## Quick in-app check

1. Open **Quests** and confirm Adaptive Directive loads normally.
2. Complete an eligible quest with its regular proof flow. A result card should
   say **ATTRIBUTE CREDIT EARNED**.
3. Open **Attributes**, select one eligible stat from **Attribute Credit
   Console**, and confirm the new value persists after a refresh.
4. As Mage, open a book and confirm the Archive reader opens without a page
   scroll behind it.
