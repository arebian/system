# Install THE SYSTEM 2.6.0

The release archive contains a full project folder named `the-system`.

1. Download `THE_SYSTEM_2_6_0_CLASS_GROWTH_FUEL.zip` to `~/Downloads`.
2. Paste the following into macOS Terminal:

```bash
cd /Users/bwoy

cp -R the-system "the-system-backup-$(date +%Y%m%d-%H%M%S)"

rm -rf /tmp/the-system-2-6
mkdir -p /tmp/the-system-2-6

unzip -q ~/Downloads/THE_SYSTEM_2_6_0_CLASS_GROWTH_FUEL.zip -d /tmp/the-system-2-6

rsync -a --exclude='.env' --exclude='.env.local' /tmp/the-system-2-6/the-system/ the-system/

cd /Users/bwoy/the-system
npm install
npm test
npm run build
npm run dev -- --port 5174
```

The `rsync` command preserves any existing local `.env` or `.env.local` file.
Do not replace Supabase keys, OAuth settings or existing deployed functions.
