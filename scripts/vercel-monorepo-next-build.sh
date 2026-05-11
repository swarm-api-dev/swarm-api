#!/usr/bin/env sh
# Vercel: supports Root Directory = repo root OR apps/<app>.
# If cwd is the Next app package, run `npm run build` there.
# Otherwise run the workspace build from the monorepo root.
set -e
WS="$1"
if [ -z "$WS" ]; then
  echo "vercel-monorepo-next-build.sh: missing workspace name (e.g. @swarmapi/landing)" >&2
  exit 1
fi
if [ -f package.json ] && grep -q "\"name\"[[:space:]]*:[[:space:]]*\"${WS}\"" package.json; then
  exec npm run build
fi
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
exec npm run build -w "$WS"
