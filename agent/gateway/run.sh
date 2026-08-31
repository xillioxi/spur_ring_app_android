#!/usr/bin/env bash
set -euo pipefail

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
nvm use 22

ROOT="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$ROOT/../runtime/spur-profile/.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

export SPUR_OFFICE_PORT="${SPUR_OFFICE_PORT:-3081}"
export SPUR_OFFICE_PUBLIC_BASE="${SPUR_OFFICE_PUBLIC_BASE:-https://api.hispurring.com}"

cd "$ROOT"
exec node server.mjs
