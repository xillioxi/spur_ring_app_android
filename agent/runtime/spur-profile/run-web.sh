#!/usr/bin/env bash
# 用 Node 22 启动 Spur 挂载后的 dsh web（勿用系统 Node 20）。
set -euo pipefail

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
nvm use 22

ROOT="$(cd "$(dirname "$0")" && pwd)"
HARNESS="$(cd "$ROOT/../deepseek-harness" && pwd)"
PLUGIN="$(cd "$ROOT/../../tools/sandbox/src" && pwd)/index.cjs"
PATCH="$ROOT/cordis.patch.resolved.yml"
ENV_FILE="$ROOT/.env"

sed "s|__SPUR_OFFICE_SANDBOX__|$PLUGIN|g" "$ROOT/cordis.patch.yml" > "$PATCH"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

cd "$HARNESS"
exec pnpm dsh web --patch "$PATCH" "$@"
