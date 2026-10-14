#!/usr/bin/env bash
set -euo pipefail
cat >&2 <<'NOTICE'
ZIP installation is retired for this shared Git repository.
This command does not copy or overwrite any files.
Read docs/COLLABORATING.md. Commit your work, then use git pull --ff-only
on main and a feature branch for changes. Submit a pull request for review.
NOTICE
exit 1
