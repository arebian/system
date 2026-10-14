# THE SYSTEM

Real life / RPG. Current app version: **2.9.7**.

## Start development

```bash
git clone https://github.com/arebian/system.git
cd system
npm ci
cp .env.example .env.local
```

Set your development Supabase URL and publishable key in `.env.local`, then run:

```bash
npm run dev -- --port 5174
```

Read [Collaboration workflow](docs/COLLABORATING.md) before making changes and [Backend recovery](docs/BACKEND_RECOVERY.md) before rebuilding or linking a database. Use feature branches and reviewed pull requests. Update a clean checkout with `git pull --ff-only`; ZIP installation is retired.

## Checks and documentation

```bash
npm test
npm run build
```

- [Project rules](AGENTS.md) — shared by Codex and Claude Code.
- [Current release notes](START_HERE_2_9_7.md).
- [API setup](API_SETUP.md).
- [Architecture](docs/ARCHITECTURE.md).
- [Historical documentation](docs/history/).

The app files, three Edge Functions, local Supabase configuration, and recovered backend baseline are versioned here. Secrets and personal/player records are not committed.
