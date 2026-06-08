#!/usr/bin/env bash
#
# Builds and deploys the Function App to Azure.
#
# Usage:
#   ./infra/deploy.sh                          # deploy with current host.json
#   ./infra/deploy.sh --provider dts           # deploy with Durable Task Scheduler
#   ./infra/deploy.sh --provider storage       # deploy with Azure Storage
#   ./infra/deploy.sh my-suffix                # custom suffix
#   ./infra/deploy.sh my-suffix --provider dts # both
#
set -euo pipefail

SUFFIX=""
PROVIDER=""

while [[ $# -gt 0 ]]; do
  case "$1" in
  --provider)
    PROVIDER="$2"
    shift 2
    ;;
  *)
    SUFFIX="$1"
    shift
    ;;
  esac
done

SUFFIX="${1:-durableevent}"
FUNCTION_APP="func-order-proc-${SUFFIX}"

echo "=== Deploying to ${FUNCTION_APP} ==="

# ──────────────────────────────────────────────
# 0. Switch host.json if --provider was specified
# ──────────────────────────────────────────────
if [[ -n "${PROVIDER}" ]]; then
  case "${PROVIDER}" in
  dts)
    echo "➤ Using Durable Task Scheduler provider..."
    cp host.dts.json host.json
    ;;
  storage)
    echo "➤ Using Azure Storage provider..."
    cp host.storage.json host.json
    ;;
  *)
    echo "Unknown provider: ${PROVIDER}. Use 'dts' or 'storage'."
    exit 1
    ;;
  esac
fi

# ──────────────────────────────────────────────
# 1. Build
# ──────────────────────────────────────────────

echo "➤ Building..."
pnpm run clean
pnpm run build

echo "➤ Installing dependencies..."
rm -rf node_modules
pnpm install --prod --config.node-linker=hoisted

# ──────────────────────────────────────────────
# 2. Deploy
# ──────────────────────────────────────────────
echo "➤ Deploying to Azure..."
func azure functionapp publish "${FUNCTION_APP}" --nozip

echo ""
echo "=== Deployment complete ==="
echo "Function App: https://${FUNCTION_APP}.azurewebsites.net"

# Restore pnpm-managed node_modules for local dev
rm -rf node_modules
pnpm install
