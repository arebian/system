# Working together on THE SYSTEM

Use this repository as the shared source of truth. Both developers read `AGENTS.md`; Claude Code imports it through `CLAUDE.md`.

## First checkout

Clone into a new folder of your choice. Keep any existing ZIP-installed folder as a backup until you have copied its private environment settings and checked for uncommitted changes.

```bash
git clone https://github.com/arebian/system.git
cd system
npm ci
cp .env.example .env.local
```

Fill in your own development project's public URL and publishable key in `.env.local`. Provider API keys and service-role keys belong in backend secrets. Each developer uses their own accounts and credentials. Run `npm run dev -- --port 5174` from the repository root.

## Each change

Start with a clean working tree. Commit your work before switching branches; never overwrite a teammate's checkout with a ZIP.

```bash
git switch main
git pull --ff-only
git switch -c feature/short-description
# Make the change.
npm test
npm run build
git add <changed-files>
git diff --cached
git commit -m "Describe the resulting change"
git push -u origin feature/short-description
```

Open a pull request against `main`. The other developer reviews it before merging. Record what changed and the checks run. Update your local `main` with `git pull --ff-only` after the merge. The deprecated `install-update.sh` stops without copying anything.

## Avoid overlapping edits

Before editing, claim the task in a GitHub issue or agree with your teammate on the exact files. Record the owner and scope in the issue/PR.

| Area | Coordination rule |
| --- | --- |
| `src/SystemGame.jsx`, `src/styles/system.css` | One active owner at a time; finish/review the PR before the next person edits these files. |
| Login/Foundation screens | Claim these modules separately from game changes. |
| Archive and AI modules | Separate PRs and owners for each feature. |
| `systemCloud.js`, Edge Functions and migrations | One backend owner per change; agree on contracts before frontend changes. |

Move small, well-tested features out of the shared game file over time. Avoid large formatting changes and unrelated refactors in feature PRs.

## Resolve a conflict

On your feature branch, commit your work, then run `git fetch origin` and `git merge origin/main`. Resolve each conflict with the teammate who owns the affected code. Preserve both intended changes, remove conflict markers, run tests/build, then commit and push. Use `git merge --abort` to abandon an unresolved merge. Never fix a conflict by replacing the whole app file with an older copy, and never force-push `main`.

## Backend releases

Use a local or separate development Supabase project for changes. New migrations come from `supabase migration new`; include them with the corresponding code in a reviewed PR. See [Backend recovery](BACKEND_RECOVERY.md) before linking an existing project. Deployments and remote schema changes are separate release actions; pulling Git does not deploy them.
