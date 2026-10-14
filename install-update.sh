#!/usr/bin/env bash
set -euo pipefail

system_patch_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
system_target="${1:-/Users/bwoy/the-system}"

if [ ! -f "$system_target/package.json" ] || [ ! -f "$system_target/src/App.jsx" ]; then
  echo "THE SYSTEM project was not found at: $system_target"
  exit 1
fi
system_target="$(cd -- "$system_target" && pwd)"
if [ "$system_patch_dir" = "$system_target" ]; then
  echo "Extract the update to a separate folder before running this installer."
  exit 1
fi
node - "$system_target/package.json" <<'NODE'
const fs = require('fs');
const version = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).version;
const parts = String(version).split('.').map(Number);
const patch = [2, 9, 7];
for (let i=0;i<3;i++) {
  if (!Number.isFinite(parts[i])) { console.error('Cannot verify the installed version.'); process.exit(1); }
  if (parts[i]>patch[i]) { console.error(`Installed version ${version} is newer than 2.9.7. Update stopped to prevent a downgrade.`); process.exit(1); }
  if (parts[i]<patch[i]) break;
}
NODE

system_backup="${system_target}-backup-$(date +%Y%m%d-%H%M%S)-$$"
mkdir -p "$system_backup"
rsync -a --exclude='node_modules' --exclude='dist' --exclude='.git' "$system_target/" "$system_backup/"
echo "Backup saved: $system_backup"
rsync -ac --exclude='.env' --exclude='.env.*' --exclude='.git' --exclude='node_modules' --exclude='dist' --exclude='test-results' "$system_patch_dir/" "$system_target/"
cd "$system_target"
npm ci
npm test
npm run build
echo "THE SYSTEM 2.9.7 is ready. Open http://localhost:5174"
npm run dev -- --port 5174 --strictPort
