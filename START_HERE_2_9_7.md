# THE SYSTEM 2.9.7 — Automatic login motion

Built from the complete 2.9.6 update.

- Removed the pause/resume button. The five class artworks cycle automatically.
- Kept the existing login layout and class preview, as requested.
- Increased artwork fades to 2.2 seconds and removed the slide/scale movement.
- The outgoing artwork stays mounted until its fade finishes.
- The next image is decoded before switching, reducing loading flashes.
- Background tint and class captions change smoothly too.
- Reduced motion and hidden-tab handling remain automatic system preferences.

This is a frontend patch. The deployed 2.9.6 Foundation backend, required weight, feet/inches height and multiple goals remain included. The real-account/device launch checklist remains in [START_HERE_2_9_6.md](docs/history/START_HERE_2_9_6.md).

## Development setup

Use the [Git collaboration workflow](docs/COLLABORATING.md). Clone into a folder of your choice, configure `.env.local` for your development backend, and install locked dependencies with `npm ci`. Use `git pull --ff-only` for a clean main checkout and feature branches for changes. ZIP installation is retired; `install-update.sh` stops without modifying files.

Read [Backend recovery](docs/BACKEND_RECOVERY.md) before rebuilding or linking a Supabase database.

## Checks

77 Node tests and the production build pass. Desktop/mobile browser checks cover all five automatic artwork transitions, absent rotation buttons, preserved login inputs, reduced motion and the Foundation measurement/goal fields. Browser authentication is simulated; this is not a new real-account OAuth test.
